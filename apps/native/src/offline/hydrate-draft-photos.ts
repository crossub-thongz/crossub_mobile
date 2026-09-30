import { parseSectionAreaName } from '@/src/constants/inspection-areas';
import { emptyRoutineIssue } from '@/src/lib/inspection-layout';
import type { RoutineAreaIssueDraft, RoutineExecutionDraft } from '@/src/lib/types';
import { applyPhotoUriRewrites, type OfflineQueueItem } from '@/src/offline/db';
import {
  dedupePhotoUrls,
  isRemotePhotoUrl,
  localPhotoExists,
  photoUrlInList,
  repairQueuedPhotoUri,
} from '@/src/offline/queued-photo';

const INGOING_SUFFIX = /\s*\(ingoing\)\s*$/i;
const OUTGOING_SUFFIX = /\s*\(outgoing\)\s*$/i;

function parseQueuedAreaName(raw: string): {
  area: string;
  section?: string;
  side?: 'ingoing' | 'outgoing';
} {
  let name = raw.trim();
  let side: 'ingoing' | 'outgoing' | undefined;
  if (INGOING_SUFFIX.test(name)) {
    side = 'ingoing';
    name = name.replace(INGOING_SUFFIX, '').trim();
  } else if (OUTGOING_SUFFIX.test(name)) {
    side = 'outgoing';
    name = name.replace(OUTGOING_SUFFIX, '').trim();
  }
  const parsed = parseSectionAreaName(name);
  if (parsed) return { area: parsed.area, section: parsed.section, side };
  return { area: name, side };
}

async function keepReachableUrls(urls: string[] | undefined): Promise<string[]> {
  const next: string[] = [];
  for (const url of urls ?? []) {
    if (!url) continue;
    const rewritten = applyPhotoUriRewrites(url);
    if (isRemotePhotoUrl(rewritten)) {
      if (!photoUrlInList(next, rewritten)) next.push(rewritten);
      continue;
    }
    // A copy in Documents is the photo we will upload. Keep it even if a
    // stat fails right after a crash, so the count cannot shrink to the
    // handful that already reached the server.
    if (rewritten.includes('/offline-queue/') || url.includes('/offline-queue/')) {
      const repaired = (await repairQueuedPhotoUri(rewritten)) ?? rewritten;
      if (!photoUrlInList(next, repaired)) next.push(repaired);
      continue;
    }
    const repaired = await repairQueuedPhotoUri(rewritten);
    const candidate = repaired ?? ((await localPhotoExists(rewritten)) ? rewritten : '');
    if (!candidate || photoUrlInList(next, candidate)) continue;
    next.push(candidate);
  }
  return dedupePhotoUrls(next);
}

async function pruneIssuePhotos(issue: RoutineAreaIssueDraft): Promise<RoutineAreaIssueDraft> {
  const photosBySection = issue.photosBySection ?? {};
  const nextSections: RoutineAreaIssueDraft['photosBySection'] = {};
  for (const [section, photos] of Object.entries(photosBySection)) {
    nextSections[section] = {
      ingoingPhotoUrls: await keepReachableUrls(photos.ingoingPhotoUrls),
      outgoingPhotoUrls: await keepReachableUrls(photos.outgoingPhotoUrls),
    };
  }
  return {
    ...issue,
    areaPhotos: await keepReachableUrls(issue.areaPhotos),
    photosBySection: nextSections,
  };
}

function collectUrls(draft: RoutineExecutionDraft): string[] {
  const urls: string[] = [];
  for (const issue of Object.values(draft.issues ?? {})) {
    for (const url of issue.areaPhotos ?? []) {
      if (!photoUrlInList(urls, url)) urls.push(url);
    }
    for (const photos of Object.values(issue.photosBySection ?? {})) {
      for (const url of photos.ingoingPhotoUrls) {
        if (!photoUrlInList(urls, url)) urls.push(url);
      }
      for (const url of photos.outgoingPhotoUrls) {
        if (!photoUrlInList(urls, url)) urls.push(url);
      }
    }
  }
  return urls;
}

function alreadyShown(present: string[], uri: string): boolean {
  if (!uri) return true;
  const resolved = applyPhotoUriRewrites(uri);
  return photoUrlInList(present, uri) || photoUrlInList(present, resolved);
}

function ensureIssue(
  issues: Record<string, RoutineAreaIssueDraft>,
  area: string,
): RoutineAreaIssueDraft {
  const current = issues[area] ?? emptyRoutineIssue();
  issues[area] = {
    ...current,
    available: current.available ?? true,
    photosBySection: current.photosBySection ?? {},
  };
  return issues[area];
}

/**
 * Drop cache URIs iOS already purged, then put queued document files back onto
 * the draft so a reopen still shows shots taken offline.
 */
export async function mergeQueuedPhotosIntoDraft(
  draft: RoutineExecutionDraft,
  items: OfflineQueueItem[],
): Promise<RoutineExecutionDraft> {
  const issues: Record<string, RoutineAreaIssueDraft> = {};
  for (const [name, issue] of Object.entries(draft.issues ?? {})) {
    issues[name] = await pruneIssuePhotos(issue);
  }
  let next: RoutineExecutionDraft = { ...draft, issues };
  const present = collectUrls(next);

  for (const item of items) {
    if (item.action !== 'photo_upload') continue;
    const localUri = typeof item.payload.localUri === 'string' ? item.payload.localUri : '';
    if (!localUri || alreadyShown(present, localUri)) continue;
    const resolved = applyPhotoUriRewrites(localUri);
    if (isRemotePhotoUrl(resolved)) continue;
    if (!(await localPhotoExists(localUri))) continue;
    const areaName = typeof item.payload.areaName === 'string' ? item.payload.areaName : '';
    if (!areaName) continue;

    const parsed = parseQueuedAreaName(areaName);
    const issue = ensureIssue(next.issues, parsed.area);
    if (parsed.section) {
      const current = issue.photosBySection?.[parsed.section] ?? {
        ingoingPhotoUrls: [],
        outgoingPhotoUrls: [],
      };
      const key = parsed.side === 'outgoing' ? 'outgoingPhotoUrls' : 'ingoingPhotoUrls';
      if (alreadyShown(current[key], localUri) || alreadyShown(present, localUri)) continue;
      next = {
        ...next,
        issues: {
          ...next.issues,
          [parsed.area]: {
            ...issue,
            available: true,
            photosBySection: {
              ...(issue.photosBySection ?? {}),
              [parsed.section]: { ...current, [key]: [...current[key], localUri] },
            },
          },
        },
      };
    } else if (!alreadyShown(issue.areaPhotos, localUri) && !alreadyShown(present, localUri)) {
      next = {
        ...next,
        issues: {
          ...next.issues,
          [parsed.area]: {
            ...issue,
            available: true,
            areaPhotos: [...issue.areaPhotos, localUri],
          },
        },
      };
    } else {
      continue;
    }
    present.push(localUri);
  }

  return next;
}
