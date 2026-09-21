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
  deleteLocalPhoto,
  preparePhotoUpload,
  yieldToUi,
  type LocalPhoto,
} from '@/src/jobs/compress-photo';
import {
  enqueueOfflineAction,
  isRetryableNetworkError,
  loadOfflineQueue,
  pendingSyncCount,
  removeQueueItem,
  type OfflineAction,
  type OfflineQueueItem,
} from '@/src/offline/db';

const DRAIN_ORDER: OfflineAction[] = [
  'photo_upload',
  'key_photo',
  'execution_draft',
  'findings',
  'key_custody',
];

function sortForDrain(items: OfflineQueueItem[]): OfflineQueueItem[] {
  return [...items].sort((a, b) => {
    const order = DRAIN_ORDER.indexOf(a.action) - DRAIN_ORDER.indexOf(b.action);
    if (order !== 0) return order;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

async function replayItem(item: OfflineQueueItem): Promise<void> {
  const payload = item.payload;
  switch (item.action) {
    case 'execution_draft':
      await saveInspectionExecutionDraft(item.jobId, {
        deviceId: String(payload.deviceId ?? ''),
        kind: payload.kind as InspectionDraftKind,
        updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined,
        draft: (payload.draft ?? {}) as Record<string, unknown>,
      });
      return;
    case 'findings':
      await saveInspectionFindings(item.jobId, payload as SaveInspectorFindings);
      return;
    case 'photo_upload': {
      const localUri = typeof payload.localUri === 'string' ? payload.localUri : '';
      if (localUri) {
        const prepared = await preparePhotoUpload({ uri: localUri, width: 0, height: 0 });
        await uploadInspectionPhoto(item.jobId, {
          ...prepared.body,
          areaName: typeof payload.areaName === 'string' ? payload.areaName : undefined,
        });
        await deleteLocalPhoto(localUri);
        if (prepared.localUri !== localUri) await deleteLocalPhoto(prepared.localUri);
        return;
      }
      if (typeof payload.contentBase64 === 'string' && payload.contentBase64) {
        await uploadInspectionPhoto(item.jobId, payload as UploadInspectorPhoto);
      }
      return;
    }
    case 'key_custody': {
      const phase = payload.phase === 'return' ? 'return' : 'collect';
      const notes = typeof payload.notes === 'string' ? payload.notes : undefined;
      await recordKeyCustody(item.jobId, phase, notes ? { notes } : {});
      return;
    }
    case 'key_photo': {
      const localUri = typeof payload.localUri === 'string' ? payload.localUri : '';
      const phase = payload.phase === 'return' ? 'return' : 'collect';
      if (localUri) {
        const prepared = await preparePhotoUpload({ uri: localUri, width: 0, height: 0 });
        await uploadKeyCustodyPhoto(item.jobId, {
          ...prepared.body,
          phase,
          fileName:
            typeof payload.fileName === 'string' ? payload.fileName : prepared.body.fileName,
        });
        await deleteLocalPhoto(localUri);
        if (prepared.localUri !== localUri) await deleteLocalPhoto(prepared.localUri);
        return;
      }
      await uploadKeyCustodyPhoto(item.jobId, {
        phase,
        fileName: String(payload.fileName ?? 'key.jpg'),
        mimeType: String(payload.mimeType ?? 'image/jpeg'),
        sizeBytes: Number(payload.sizeBytes ?? 0),
        contentBase64: String(payload.contentBase64 ?? ''),
      });
      return;
    }
    default:
      return;
  }
}

export async function syncOfflineQueue(): Promise<{ synced: number; remaining: number }> {
  const queue = sortForDrain(await loadOfflineQueue());
  let synced = 0;
  for (const item of queue) {
    try {
      await replayItem(item);
      await removeQueueItem(item.id);
      synced += 1;
    } catch (err) {
      if (isRetryableNetworkError(err)) break;
      // Drop a permanently rejected item so it cannot block the rest of the queue.
      await removeQueueItem(item.id);
    }
  }
  return { synced, remaining: await pendingSyncCount() };
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
  try {
    await saveInspectionExecutionDraft(inspectionId, body);
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    await enqueueOfflineAction(inspectionId, 'execution_draft', body);
  }
}

export async function queueInspectionPhoto(
  inspectionId: string,
  body: UploadInspectorPhoto,
  localUri: string,
  options?: { keepLocal?: boolean },
): Promise<{ url: string }> {
  try {
    const uploaded = await uploadInspectionPhoto(inspectionId, body);
    if (!options?.keepLocal) await deleteLocalPhoto(localUri);
    return uploaded;
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    await enqueueOfflineAction(inspectionId, 'photo_upload', {
      localUri,
      areaName: body.areaName,
      fileName: body.fileName,
    });
    return { url: localUri };
  }
}

export async function queueInspectionPhotoBatch(
  inspectionId: string,
  photos: LocalPhoto[],
  areaName: string,
  onEach?: (localUri: string, remoteUrl: string) => void,
): Promise<string[]> {
  const urls: string[] = [];
  for (const photo of photos) {
    const prepared = await preparePhotoUpload(photo);
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
  try {
    await saveInspectionFindings(inspectionId, body);
    return 'synced';
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    await enqueueOfflineAction(inspectionId, 'findings', body as unknown as Record<string, unknown>);
    return 'queued';
  }
}

export async function queueKeyCustody(
  inspectionId: string,
  phase: 'collect' | 'return',
  body: { notes?: string } = {},
): Promise<InspectorKeyCustody | 'queued'> {
  try {
    return await recordKeyCustody(inspectionId, phase, body);
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    await enqueueOfflineAction(inspectionId, 'key_custody', { phase, notes: body.notes });
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
  try {
    const custody = await uploadKeyCustodyPhoto(inspectionId, body);
    const urls = body.phase === 'return' ? custody.returnPhotos : custody.collectPhotos;
    return { url: urls[urls.length - 1] ?? localUri ?? '' };
  } catch (err) {
    if (!isRetryableNetworkError(err)) throw err;
    if (localUri) {
      await enqueueOfflineAction(inspectionId, 'key_photo', {
        phase: body.phase,
        localUri,
        fileName: body.fileName,
      });
      return { url: localUri };
    }
    await enqueueOfflineAction(inspectionId, 'key_photo', body);
    return { url: localUri ?? '' };
  }
}
