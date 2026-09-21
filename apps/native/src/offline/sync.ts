import * as Network from 'expo-network';

import {
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
import {
  compressPhotoToFile,
  deleteLocalPhoto,
  preparePhotoUpload,
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
  removeQueueItem,
  replaceOfflineAction,
  rewriteQueuedUris,
  type OfflineAction,
  type OfflineQueueItem,
} from '@/src/offline/db';
import {
  deleteQueuedPhoto,
  localPhotoExists,
  persistQueuedPhoto,
  writeQueuedPhotoFromBase64,
} from '@/src/offline/queued-photo';

const DRAIN_ORDER: OfflineAction[] = [
  'photo_upload',
  'key_photo',
  'execution_draft',
  'findings',
  'key_custody',
];

const MISSING_FILE_DROP_AFTER = 3;

let drainInFlight: Promise<{ synced: number; remaining: number }> | null = null;

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
    return Boolean(state.isConnected) && state.isInternetReachable !== false;
  } catch {
    return true;
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
  if (!localUri && typeof payload.contentBase64 === 'string' && payload.contentBase64) {
    localUri = await writeQueuedPhotoFromBase64(payload.contentBase64);
  }
  if (!localUri) throw new Error('Photo is missing from this device.');
  if (!(await localPhotoExists(localUri))) {
    throw new Error('Photo is missing from this device.');
  }
  const prepared = await preparePhotoUpload({ uri: localUri, width: 0, height: 0 });
  const uploaded = await uploadInspectionPhoto(item.jobId, {
    ...prepared.body,
    areaName: typeof payload.areaName === 'string' ? payload.areaName : undefined,
  });
  await deleteQueuedPhoto(localUri);
  if (prepared.localUri !== localUri) await deleteLocalPhoto(prepared.localUri);
  return uploaded.url ?? null;
}

async function replayKeyPhoto(item: OfflineQueueItem): Promise<string | null> {
  const payload = item.payload;
  const phase = payload.phase === 'return' ? 'return' : 'collect';
  let localUri = typeof payload.localUri === 'string' ? payload.localUri : '';
  if (!localUri && typeof payload.contentBase64 === 'string' && payload.contentBase64) {
    localUri = await writeQueuedPhotoFromBase64(payload.contentBase64);
  }
  if (!localUri) throw new Error('Photo is missing from this device.');
  if (!(await localPhotoExists(localUri))) {
    throw new Error('Photo is missing from this device.');
  }
  const prepared = await preparePhotoUpload({ uri: localUri, width: 0, height: 0 });
  const custody = await uploadKeyCustodyPhoto(item.jobId, {
    ...prepared.body,
    phase,
    fileName: typeof payload.fileName === 'string' ? payload.fileName : prepared.body.fileName,
  });
  await deleteQueuedPhoto(localUri);
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
      await recordKeyCustody(item.jobId, phase, notes ? { notes } : {});
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
  return message.includes('missing from this device') || message.includes('could not encode');
}

async function drainQueue(): Promise<{ synced: number; remaining: number }> {
  if (!(await isDeviceOnline())) {
    return { synced: 0, remaining: await pendingSyncCount() };
  }
  const queue = sortForDrain(await loadOfflineQueue());
  let synced = 0;
  for (const item of queue) {
    try {
      const remoteUrl = await replayItem(item);
      const localUri =
        typeof item.payload.localUri === 'string' ? item.payload.localUri : '';
      if (remoteUrl && localUri) await rewriteQueuedUris(localUri, remoteUrl);
      await removeQueueItem(item.id);
      synced += 1;
      await yieldToUi();
    } catch (err) {
      if (isAuthError(err) || isRetryableNetworkError(err)) break;
      if (isMissingFileError(err)) {
        const attempts = await bumpQueueAttempt(item.id);
        if (attempts >= MISSING_FILE_DROP_AFTER) {
          const uri = typeof item.payload.localUri === 'string' ? item.payload.localUri : undefined;
          await deleteQueuedPhoto(uri);
          await removeQueueItem(item.id);
        }
        continue;
      }
      if (isPermanentPhotoError(err)) {
        const uri = typeof item.payload.localUri === 'string' ? item.payload.localUri : undefined;
        await deleteQueuedPhoto(uri);
        await removeQueueItem(item.id);
        continue;
      }
      break;
    }
  }
  return { synced, remaining: await pendingSyncCount() };
}

export async function syncOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  if (drainInFlight) return drainInFlight;
  drainInFlight = drainQueue().finally(() => {
    drainInFlight = null;
  });
  return drainInFlight;
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
  onEach?: (localUri: string, remoteUrl: string) => void,
): Promise<string[]> {
  const urls: string[] = [];
  const online = await isDeviceOnline();
  for (const photo of photos) {
    const compressed = await compressPhotoToFile(photo);
    if (!online) {
      const durable = await persistQueuedPhoto(compressed.uri);
      await enqueueOfflineAction(inspectionId, 'photo_upload', {
        localUri: durable,
        areaName,
      });
      urls.push(durable);
      onEach?.(photo.uri, durable);
      if (compressed.uri !== durable) await deleteLocalPhoto(compressed.uri);
      if (photo.uri !== compressed.uri && photo.uri !== durable) {
        await deleteLocalPhoto(photo.uri);
      }
      await yieldToUi();
      continue;
    }
    const prepared = await preparePhotoUpload(compressed);
    const saved = await queueInspectionPhoto(
      inspectionId,
      { ...prepared.body, areaName },
      prepared.localUri,
      { keepLocal: true },
    );
    urls.push(saved.url);
    onEach?.(photo.uri, saved.url);
    if (saved.url !== prepared.localUri) await deleteLocalPhoto(prepared.localUri);
    if (photo.uri !== prepared.localUri && saved.url !== photo.uri) {
      await deleteLocalPhoto(photo.uri);
    }
    await yieldToUi();
  }
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
): Promise<InspectorKeyCustody | 'queued'> {
  if (!(await isDeviceOnline())) {
    await replaceOfflineAction(
      inspectionId,
      'key_custody',
      { phase, notes: body.notes },
      phase,
    );
    return 'queued';
  }
  try {
    return await recordKeyCustody(inspectionId, phase, body);
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    await replaceOfflineAction(
      inspectionId,
      'key_custody',
      { phase, notes: body.notes },
      phase,
    );
    return 'queued';
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
