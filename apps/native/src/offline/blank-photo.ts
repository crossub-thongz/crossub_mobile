import { deleteLocalPhoto } from '@/src/jobs/compress-photo';
import { sameLocalPhotoUri } from '@/src/lib/local-file';
import {
  applyPhotoUriRewrites,
  deleteQueueItemsByLocalUri,
  loadAllDrafts,
  loadAllHandoverDrafts,
  rememberDroppedPhotoUri,
  removeQueueItem,
  saveDraftLocal,
  saveHandoverDraft,
} from '@/src/offline/db';
import { dedupeDraftPhotoLists, deleteQueuedPhoto } from '@/src/offline/queued-photo';

/**
 * Drop a blank capture from the queue, the phone, and the inspection draft.
 * Leaving the queue row in place blocks Finalise.
 */
export async function discardBlankPhoto(uri: string, queueItemId?: string): Promise<void> {
  if (!uri) return;
  rememberDroppedPhotoUri(uri);
  if (queueItemId) await removeQueueItem(queueItemId);
  await deleteQueueItemsByLocalUri(uri);
  await deleteLocalPhoto(uri);
  await deleteQueuedPhoto(uri);

  const drafts = await loadAllDrafts();
  for (const [id, draft] of Object.entries(drafts)) {
    const next = dedupeDraftPhotoLists(applyPhotoUriRewrites(draft));
    if (JSON.stringify(next) !== JSON.stringify(draft)) await saveDraftLocal(id, next);
  }

  const handovers = await loadAllHandoverDrafts();
  for (const row of handovers) {
    const photoUrls = row.draft.photoUrls.filter((url) => {
      const rewritten = applyPhotoUriRewrites(url);
      return Boolean(rewritten) && !sameLocalPhotoUri(url, uri);
    });
    if (photoUrls.length !== row.draft.photoUrls.length) {
      await saveHandoverDraft(row.jobId, row.phase, { ...row.draft, photoUrls });
    }
  }
}
