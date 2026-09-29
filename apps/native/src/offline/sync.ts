import * as Network from 'expo-network';

import {
  completeInspection,
  recordKeyCustody,
  saveInspectionExecutionDraft,
  saveInspectionFindings,
  uploadInspectionPhoto,
  uploadKeyCustodyPhoto,
  type InspectionDraftKind,
  type InspectorKeyCustody,
  type SaveInspectorFindings,
  type UploadInspectorPhoto,
} from '@/src/api/inspector';
import { getAccessToken } from '@/src/auth/session';
import { attendanceWindowFromHours } from '@/src/lib/findings';
import {
  deleteLocalPhoto,
  prepareStoredPhotoUpload,
  yieldToUi,
  type LocalPhoto,
} from '@/src/jobs/compress-photo';
import {
  bumpQueueAttempt,
  enqueueOfflineAction,
  isAuthError,
  isPermanentPhotoError,
  isRetryableNetworkError,
  loadOfflineQueue,
  pendingSyncCount,
  queueHasLocalUri,
  removeQueueItem,
  replaceOfflineAction,
  noteUploadedPhoto,
  flushUploadedPhotoDrafts,
  deleteQueueItemsByLocalUri,
  applyPhotoUriRewrites,
  type OfflineAction,
  type OfflineQueueItem,
} from '@/src/offline/db';
import {
  compressAndPersistPhoto,
  deleteQueuedPhoto,
  isDurableLocalPhoto,
  isRemotePhotoUrl,
  localPhotoExists,
  persistQueuedPhoto,
  repairQueuedPhotoUri,
  writeQueuedPhotoFromBase64,
} from '@/src/offline/queued-photo';
import { recoverUnsentPhotos } from '@/src/offline/recover-unsent-photos';

const DRAIN_ORDER: OfflineAction[] = [
  'photo_upload',
  'key_photo',
  'execution_draft',
  'findings',
  'key_custody',
];

const MISSING_FILE_DROP_AFTER = 8;
const PHOTO_UPLOAD_TIMEOUT_MS = 30_000;
const PHOTO_UPLOAD_CONCURRENCY = 3;
/** Automatic sync sends the newest photos only, so a stuck backlog cannot hold the banner open. */
const AUTO_PHOTO_BATCH = 24;
const AUTO_PHOTO_ATTEMPT_CAP = 2;

let drainInFlight: Promise<{ synced: number; remaining: number }> | null = null;
let drainAgain = false;
let drainForce = false;

export type SyncProgress = { completed: number; total: number };

const syncProgressListeners = new Set<(progress: SyncProgress | null) => void>();
let currentSyncProgress: SyncProgress | null = null;

export function subscribeSyncProgress(
  listener: (progress: SyncProgress | null) => void,
): () => void {
  syncProgressListeners.add(listener);
  listener(currentSyncProgress);
  return () => {
    syncProgressListeners.delete(listener);
  };
}

function emitSyncProgress(progress: SyncProgress | null): void {
  currentSyncProgress = progress;
  for (const listener of syncProgressListeners) listener(progress);
}

function isPhotoQueueAction(action: string): boolean {
  return action === 'photo_upload' || action === 'key_photo';
}

async function mapPool<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

async function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sortForDrain(items: OfflineQueueItem[]): OfflineQueueItem[] {
  return [...items].sort((a, b) => {
    const order = DRAIN_ORDER.indexOf(a.action) - DRAIN_ORDER.indexOf(b.action);
    if (order !== 0) return order;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export async function isDeviceOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    // iOS often reports isInternetReachable=false on working Wi-Fi. Try anyway
    // whenever the radio is up so queued photos can leave the device.
    return state.isConnected !== false;
  } catch {
    return true;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isAlreadyCompletedConflict(err: unknown): boolean {
  return /cannot move a completed inspection to completed/i.test(errorMessage(err));
}

function isReturnBeforeCompleteConflict(err: unknown): boolean {
  return /return the keys only after the inspection is completed/i.test(
    errorMessage(err),
  );
}

/** Nest recordKeyReturn requires COMPLETED. Match the PWA: complete, then stamp return. */
async function completeInspectionForKeyReturn(
  inspectionId: string,
  estimatedHours?: number,
): Promise<void> {
  try {
    await completeInspection(
      inspectionId,
      attendanceWindowFromHours(estimatedHours ?? 1),
    );
  } catch (err) {
    if (isAlreadyCompletedConflict(err)) return;
    throw err;
  }
}

async function persistPhotoPayload(localUri?: string, contentBase64?: string): Promise<string> {
  if (localUri) return persistQueuedPhoto(localUri);
  if (contentBase64) return writeQueuedPhotoFromBase64(contentBase64);
  throw new Error('Photo is missing from this device.');
}

async function replayPhotoUpload(item: OfflineQueueItem): Promise<string | null> {
  const payload = item.payload;
  let localUri = typeof payload.localUri === 'string' ? payload.localUri : '';
  const rewritten = localUri ? applyPhotoUriRewrites(localUri) : '';
  if (isRemotePhotoUrl(localUri)) return localUri;
  if (isRemotePhotoUrl(rewritten)) return rewritten;
  if (localUri) localUri = (await repairQueuedPhotoUri(localUri)) ?? localUri;
  if (!localUri && typeof payload.contentBase64 === 'string' && payload.contentBase64) {
    localUri = await writeQueuedPhotoFromBase64(payload.contentBase64);
  }
  if (!localUri) throw new Error('Photo is missing from this device.');
  if (isRemotePhotoUrl(localUri) || isRemotePhotoUrl(applyPhotoUriRewrites(localUri))) {
    return isRemotePhotoUrl(localUri) ? localUri : applyPhotoUriRewrites(localUri);
  }
  if (!(await localPhotoExists(localUri))) {
    throw new Error('Photo is missing from this device.');
  }
  const prepared = await prepareStoredPhotoUpload(localUri);
  const uploaded = await withTimeout(
    uploadInspectionPhoto(item.jobId, {
      ...prepared.body,
      areaName: typeof payload.areaName === 'string' ? payload.areaName : undefined,
    }),
    PHOTO_UPLOAD_TIMEOUT_MS,
    'Photo upload',
  );
  if (prepared.localUri !== localUri) await deleteLocalPhoto(prepared.localUri);
  return uploaded.url ?? null;
}

async function replayKeyPhoto(item: OfflineQueueItem): Promise<string | null> {
  const payload = item.payload;
  const phase = payload.phase === 'return' ? 'return' : 'collect';
  let localUri = typeof payload.localUri === 'string' ? payload.localUri : '';
  if (localUri) localUri = (await repairQueuedPhotoUri(localUri)) ?? localUri;
  if (!localUri && typeof payload.contentBase64 === 'string' && payload.contentBase64) {
    localUri = await writeQueuedPhotoFromBase64(payload.contentBase64);
  }
  if (!localUri) throw new Error('Photo is missing from this device.');
  if (!(await localPhotoExists(localUri))) {
    throw new Error('Photo is missing from this device.');
  }
  const prepared = await prepareStoredPhotoUpload(localUri);
  const custody = await withTimeout(
    uploadKeyCustodyPhoto(item.jobId, {
      ...prepared.body,
      phase,
      fileName: typeof payload.fileName === 'string' ? payload.fileName : prepared.body.fileName,
    }),
    PHOTO_UPLOAD_TIMEOUT_MS,
    'Key photo upload',
  );
  if (prepared.localUri !== localUri) await deleteLocalPhoto(prepared.localUri);
  const urls = phase === 'return' ? custody.returnPhotos : custody.collectPhotos;
  return urls[urls.length - 1] ?? null;
}

async function replayItem(item: OfflineQueueItem): Promise<string | null> {
  const payload = item.payload;
  switch (item.action) {
    case 'execution_draft':
      await saveInspectionExecutionDraft(item.jobId, {
        deviceId: String(payload.deviceId ?? ''),
        kind: payload.kind as InspectionDraftKind,
        updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined,
        draft: (payload.draft ?? {}) as Record<string, unknown>,
      });
      return null;
    case 'findings':
      await saveInspectionFindings(item.jobId, payload as SaveInspectorFindings);
      return null;
    case 'photo_upload':
      return replayPhotoUpload(item);
    case 'key_custody': {
      const phase = payload.phase === 'return' ? 'return' : 'collect';
      const notes = typeof payload.notes === 'string' ? payload.notes : undefined;
      const estimatedHours =
        typeof payload.estimatedHours === 'number' ? payload.estimatedHours : undefined;
      const needsComplete = phase === 'return' && payload.needsComplete !== false;
      if (needsComplete) {
        await completeInspectionForKeyReturn(item.jobId, estimatedHours);
      }
      try {
        await recordKeyCustody(item.jobId, phase, notes ? { notes } : {});
      } catch (err) {
        if (!isReturnBeforeCompleteConflict(err)) throw err;
        await completeInspectionForKeyReturn(item.jobId, estimatedHours);
        await recordKeyCustody(item.jobId, phase, notes ? { notes } : {});
      }
      return null;
    }
    case 'key_photo':
      return replayKeyPhoto(item);
    default:
      return null;
  }
}

function isMissingFileError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes('missing from this device') ||
    message.includes('could not encode') ||
    message.includes('no longer on this phone') ||
    message.includes('take it again')
  );
}

async function settlePhotoItem(item: OfflineQueueItem): Promise<boolean> {
  const localUri = typeof item.payload.localUri === 'string' ? item.payload.localUri : '';
  const rewritten = localUri ? applyPhotoUriRewrites(localUri) : '';
  if (isRemotePhotoUrl(localUri) || isRemotePhotoUrl(rewritten)) {
    const remote = isRemotePhotoUrl(localUri) ? localUri : rewritten;
    if (localUri && remote && localUri !== remote) noteUploadedPhoto(localUri, remote);
    await removeQueueItem(item.id);
    return Boolean(localUri && remote && localUri !== remote);
  }
  const remoteUrl = await withTimeout(
    item.action === 'key_photo' ? replayKeyPhoto(item) : replayPhotoUpload(item),
    PHOTO_UPLOAD_TIMEOUT_MS,
    'Photo upload',
  );
  if (!remoteUrl || !isRemotePhotoUrl(remoteUrl)) {
    throw new Error('Photo upload did not return a link.');
  }
  if (localUri) {
    noteUploadedPhoto(localUri, remoteUrl);
    await deleteQueueItemsByLocalUri(localUri);
  } else {
    await removeQueueItem(item.id);
  }
  return true;
}

async function keepFailedPhoto(item: OfflineQueueItem, err: unknown): Promise<void> {
  if (isMissingFileError(err)) {
    const attempts = await bumpQueueAttempt(item.id);
    if (attempts >= MISSING_FILE_DROP_AFTER) {
      const uri = typeof item.payload.localUri === 'string' ? item.payload.localUri : undefined;
      await deleteQueuedPhoto(uri);
      await removeQueueItem(item.id);
    }
    return;
  }
  if (isPermanentPhotoError(err)) {
    const uri = typeof item.payload.localUri === 'string' ? item.payload.localUri : undefined;
    await deleteQueuedPhoto(uri);
    await removeQueueItem(item.id);
    return;
  }
  await bumpQueueAttempt(item.id);
}

async function drainQueue(force: boolean): Promise<{ synced: number; remaining: number }> {
  if (!(await getAccessToken())) {
    emitSyncProgress(null);
    return { synced: 0, remaining: await pendingSyncCount() };
  }
  const queue = await loadOfflineQueue();
  const photos = queue
    .filter((item) => isPhotoQueueAction(item.action))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const photoPass = force
    ? photos
    : photos.filter((item) => item.attempts < AUTO_PHOTO_ATTEMPT_CAP).slice(0, AUTO_PHOTO_BATCH);
  const others = sortForDrain(queue.filter((item) => !isPhotoQueueAction(item.action)));
  let synced = 0;
  let notedUpload = false;
  let stopPhotos = false;

  if (photoPass.length > 0) {
    let completed = 0;
    emitSyncProgress({ completed: 0, total: photoPass.length });
    await mapPool(photoPass, PHOTO_UPLOAD_CONCURRENCY, async (item) => {
      if (stopPhotos) return;
      try {
        const noted = await settlePhotoItem(item);
        if (noted) notedUpload = true;
        synced += 1;
      } catch (err) {
        if (isAuthError(err)) {
          stopPhotos = true;
          return;
        }
        await keepFailedPhoto(item, err);
      } finally {
        if (!stopPhotos) {
          completed += 1;
          emitSyncProgress({
            completed: Math.min(completed, photoPass.length),
            total: photoPass.length,
          });
        }
        await yieldToUi();
      }
    });
  }
  emitSyncProgress(null);

  if (notedUpload) {
    try {
      await flushUploadedPhotoDrafts();
    } catch {
      // The in-memory map still marks these photos as uploaded.
    }
  }

  if (!stopPhotos) {
    for (const item of others) {
      try {
        await withTimeout(replayItem(item), PHOTO_UPLOAD_TIMEOUT_MS, 'Upload');
        await removeQueueItem(item.id);
        synced += 1;
        await yieldToUi();
      } catch (err) {
        if (isAuthError(err) || isRetryableNetworkError(err)) break;
        break;
      }
    }
  }
  return { synced, remaining: await pendingSyncCount() };
}

export async function syncOfflineQueue(options?: {
  force?: boolean;
}): Promise<{ synced: number; remaining: number }> {
  if (options?.force) drainForce = true;
  if (drainInFlight) {
    drainAgain = true;
    return drainInFlight;
  }
  drainInFlight = (async () => {
    let synced = 0;
    let remaining = await pendingSyncCount();
    do {
      drainAgain = false;
      const force = drainForce;
      drainForce = false;
      const pass = await drainQueue(force);
      synced += pass.synced;
      remaining = pass.remaining;
    } while (drainAgain);
    return { synced, remaining };
  })().finally(() => {
    drainInFlight = null;
    emitSyncProgress(null);
  });
  return drainInFlight;
}

/** Push the existing queue first so a restart does not stall behind recover. */
export async function flushOfflineWork(options?: {
  force?: boolean;
}): Promise<{ synced: number; remaining: number }> {
  try {
    const first = await syncOfflineQueue(options);
    try {
      await recoverUnsentPhotos();
    } catch {
      // Drafts stay on disk even if enqueue fails.
    }
    const second = await syncOfflineQueue(options);
    return {
      synced: first.synced + second.synced,
      remaining: second.remaining,
    };
  } finally {
    emitSyncProgress(null);
  }
}

/** Persist the JPEG, record it in the SQLite queue, then let drain upload. */
export async function enqueuePhotoUpload(
  inspectionId: string,
  localUri: string,
  areaName?: string,
  options?: { drain?: boolean },
): Promise<string> {
  if (!localUri) throw new Error('Photo is missing from this device.');
  const drain = options?.drain !== false;
  const kickDrain = () => {
    if (drain) void syncOfflineQueue();
  };
  const rewritten = applyPhotoUriRewrites(localUri);
  if (isRemotePhotoUrl(rewritten)) return rewritten;
  if (await queueHasLocalUri(localUri, inspectionId)) {
    kickDrain();
    return localUri;
  }
  const durable =
    isDurableLocalPhoto(localUri) && (await localPhotoExists(localUri))
      ? localUri
      : await persistPhotoPayload(localUri);
  if (isRemotePhotoUrl(applyPhotoUriRewrites(durable))) return applyPhotoUriRewrites(durable);
  if (await queueHasLocalUri(durable, inspectionId)) {
    kickDrain();
    return durable;
  }
  await enqueueOfflineAction(inspectionId, 'photo_upload', {
    localUri: durable,
    areaName,
  });
  kickDrain();
  return durable;
}

export async function queueExecutionDraft(
  inspectionId: string,
  body: {
    deviceId: string;
    kind: InspectionDraftKind;
    updatedAt?: string;
    draft: Record<string, unknown>;
  },
): Promise<void> {
  if (!(await isDeviceOnline())) {
    await replaceOfflineAction(inspectionId, 'execution_draft', body);
    return;
  }
  try {
    await saveInspectionExecutionDraft(inspectionId, body);
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    await replaceOfflineAction(inspectionId, 'execution_draft', body);
  }
}

export async function queueInspectionPhoto(
  inspectionId: string,
  body: UploadInspectorPhoto,
  localUri: string,
  options?: { keepLocal?: boolean },
): Promise<{ url: string }> {
  if (!(await isDeviceOnline())) {
    const durable = await persistPhotoPayload(localUri);
    await enqueueOfflineAction(inspectionId, 'photo_upload', {
      localUri: durable,
      areaName: body.areaName,
      fileName: body.fileName,
    });
    return { url: durable };
  }
  try {
    const uploaded = await uploadInspectionPhoto(inspectionId, body);
    if (!options?.keepLocal) await deleteLocalPhoto(localUri);
    return uploaded;
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    const durable = await persistPhotoPayload(localUri);
    await enqueueOfflineAction(inspectionId, 'photo_upload', {
      localUri: durable,
      areaName: body.areaName,
      fileName: body.fileName,
    });
    return { url: durable };
  }
}

export async function queueInspectionPhotoBatch(
  inspectionId: string,
  photos: LocalPhoto[],
  areaName: string,
  onEach?: (fromUri: string, toUri: string) => void,
): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos) {
    if (isRemotePhotoUrl(photo.uri)) {
      onEach?.(photo.uri, photo.uri);
      urls.push(photo.uri);
      await yieldToUi();
      continue;
    }
    try {
      const compressed = isDurableLocalPhoto(photo.uri)
        ? photo
        : await compressAndPersistPhoto(photo);
      const durable = await enqueuePhotoUpload(inspectionId, compressed.uri, areaName);
      onEach?.(photo.uri, durable);
      urls.push(durable);
    } catch {
      onEach?.(photo.uri, photo.uri);
      urls.push(photo.uri);
    }
    await yieldToUi();
  }
  void syncOfflineQueue();
  return urls;
}

export async function queueInspectionFindings(
  inspectionId: string,
  body: SaveInspectorFindings,
): Promise<'synced' | 'queued'> {
  if (!(await isDeviceOnline())) {
    await replaceOfflineAction(
      inspectionId,
      'findings',
      body as unknown as Record<string, unknown>,
    );
    return 'queued';
  }
  try {
    await saveInspectionFindings(inspectionId, body);
    return 'synced';
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    await replaceOfflineAction(
      inspectionId,
      'findings',
      body as unknown as Record<string, unknown>,
    );
    return 'queued';
  }
}

export async function queueKeyCustody(
  inspectionId: string,
  phase: 'collect' | 'return',
  body: { notes?: string } = {},
  options?: { estimatedHours?: number; alreadyCompleted?: boolean },
): Promise<InspectorKeyCustody | 'queued'> {
  const needsComplete = phase === 'return' && options?.alreadyCompleted !== true;
  const enqueue = async (completeFirst: boolean): Promise<'queued'> => {
    await replaceOfflineAction(
      inspectionId,
      'key_custody',
      {
        phase,
        notes: body.notes,
        estimatedHours: options?.estimatedHours,
        needsComplete: completeFirst,
      },
      phase,
    );
    return 'queued';
  };
  if (!(await isDeviceOnline())) {
    return enqueue(needsComplete);
  }
  try {
    if (needsComplete) {
      await completeInspectionForKeyReturn(inspectionId, options?.estimatedHours);
    }
    try {
      return await recordKeyCustody(inspectionId, phase, body);
    } catch (err) {
      if (!isReturnBeforeCompleteConflict(err)) throw err;
      await completeInspectionForKeyReturn(inspectionId, options?.estimatedHours);
      return await recordKeyCustody(inspectionId, phase, body);
    }
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    return enqueue(needsComplete);
  }
}

export async function queueKeyCustodyPhoto(
  inspectionId: string,
  body: {
    phase: 'collect' | 'return';
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    contentBase64: string;
  },
  localUri?: string,
): Promise<{ url: string }> {
  const enqueue = async (): Promise<{ url: string }> => {
    const durable = await persistPhotoPayload(localUri, body.contentBase64);
    await enqueueOfflineAction(inspectionId, 'key_photo', {
      phase: body.phase,
      localUri: durable,
      fileName: body.fileName,
    });
    return { url: durable };
  };
  if (!(await isDeviceOnline())) return enqueue();
  try {
    const custody = await uploadKeyCustodyPhoto(inspectionId, body);
    const urls = body.phase === 'return' ? custody.returnPhotos : custody.collectPhotos;
    return { url: urls[urls.length - 1] ?? localUri ?? '' };
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    return enqueue();
  }
}
