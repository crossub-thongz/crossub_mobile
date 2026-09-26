import { photoAreaName } from '@/src/constants/inspection-areas';
import { sameLocalPhotoUri } from '@/src/lib/local-file';
import type { RoutineExecutionDraft } from '@/src/lib/types';
import {
  enqueueOfflineAction,
  loadAllDrafts,
  loadAllHandoverDrafts,
  loadOfflineQueue,
  saveDraftLocal,
  type OfflineQueueItem,
} from '@/src/offline/db';
import { mergeQueuedPhotosIntoDraft } from '@/src/offline/hydrate-draft-photos';
import {
  isRemotePhotoUrl,
  persistQueuedPhoto,
  repairQueuedPhotoUri,
} from '@/src/offline/queued-photo';

function queuedUris(items: OfflineQueueItem[]): Set<string> {
  const uris = new Set<string>();
  for (const item of items) {
    if (item.action !== 'photo_upload' && item.action !== 'key_photo') continue;
    const localUri = typeof item.payload.localUri === 'string' ? item.payload.localUri : '';
    if (localUri) uris.add(localUri);
  }
  return uris;
}

function alreadyQueued(uris: Set<string>, uri: string): boolean {
  if (uris.has(uri)) return true;
  for (const existing of uris) {
    if (sameLocalPhotoUri(existing, uri)) return true;
  }
  return false;
}

async function enqueueLocalPhoto(
  jobId: string,
  action: 'photo_upload' | 'key_photo',
  url: string,
  extra: Record<string, unknown>,
  uris: Set<string>,
): Promise<number> {
  if (!url || isRemotePhotoUrl(url)) return 0;
  let durable = '';
  try {
    durable = (await repairQueuedPhotoUri(url)) ?? (await persistQueuedPhoto(url));
  } catch {
    return 0;
  }
  if (!durable || isRemotePhotoUrl(durable) || alreadyQueued(uris, durable)) return 0;
  await enqueueOfflineAction(jobId, action, { localUri: durable, ...extra });
  uris.add(durable);
  return 1;
}

async function recoverDraftPhotos(
  jobId: string,
  draft: RoutineExecutionDraft,
  uris: Set<string>,
): Promise<number> {
  let added = 0;
  for (const [area, issue] of Object.entries(draft.issues ?? {})) {
    for (const url of issue.areaPhotos ?? []) {
      added += await enqueueLocalPhoto(jobId, 'photo_upload', url, { areaName: area }, uris);
    }
    for (const [section, photos] of Object.entries(issue.photosBySection ?? {})) {
      for (const url of photos.ingoingPhotoUrls ?? []) {
        added += await enqueueLocalPhoto(
          jobId,
          'photo_upload',
          url,
          { areaName: photoAreaName(area, section, 'ingoing') },
          uris,
        );
      }
      for (const url of photos.outgoingPhotoUrls ?? []) {
        added += await enqueueLocalPhoto(
          jobId,
          'photo_upload',
          url,
          { areaName: photoAreaName(area, section, 'outgoing') },
          uris,
        );
      }
    }
  }
  return added;
}

let recoverInFlight: Promise<number> | null = null;

/**
 * Walk local drafts and the photo folder. Queue any file that is still on the
 * phone but not on the server, then put those URIs back onto the draft.
 */
export async function recoverUnsentPhotos(): Promise<number> {
  if (recoverInFlight) return recoverInFlight;
  recoverInFlight = (async () => {
  const queue = await loadOfflineQueue();
  const uris = queuedUris(queue);
  let added = 0;

  const drafts = await loadAllDrafts();
  for (const [jobId, draft] of Object.entries(drafts)) {
    added += await recoverDraftPhotos(jobId, draft, uris);
  }

  const handovers = await loadAllHandoverDrafts();
  for (const row of handovers) {
    for (const url of row.draft.photoUrls) {
      added += await enqueueLocalPhoto(
        row.jobId,
        'key_photo',
        url,
        { phase: row.phase },
        uris,
      );
    }
  }

  const refreshed = await loadOfflineQueue();
  const byJob = new Map<string, OfflineQueueItem[]>();
  for (const item of refreshed) {
    if (item.action !== 'photo_upload') continue;
    const list = byJob.get(item.jobId) ?? [];
    list.push(item);
    byJob.set(item.jobId, list);
  }
  for (const [jobId, draft] of Object.entries(drafts)) {
    const merged = await mergeQueuedPhotosIntoDraft(draft, byJob.get(jobId) ?? []);
    if (JSON.stringify(merged) !== JSON.stringify(draft)) {
      await saveDraftLocal(jobId, merged);
    }
  }

  return added;
  })().finally(() => {
    recoverInFlight = null;
  });
  return recoverInFlight;
}
