import type { components } from '@crossub-thongz/api-contract';

import { INSPECTION_STATUS, INSPECTION_TYPE } from '@/constants/api-enums';
import type { InspectorCalendarAvailability } from '@/lib/inspector-timetable';

import { crossub } from './client';

export type InspectorJob = components['schemas']['InspectorJobResponseDto'];
export type InspectorInspection = components['schemas']['InspectorInspectionResponseDto'];
export type InspectorInspectionDetail =
  components['schemas']['InspectorInspectionDetailDto'];
export type CompleteInspectorInspection =
  components['schemas']['CompleteInspectorInspectionDto'];
export type FileInspectorReport = components['schemas']['FileInspectorReportDto'];
export type InspectorMessageThread =
  components['schemas']['InspectorMessageThreadResponseDto'];
// Aliased `...Dto` to avoid colliding with the FE view-model `InspectorNotification`.
export type InspectorNotificationDto =
  components['schemas']['InspectorNotificationResponseDto'];
export type InspectorPhoto = components['schemas']['InspectorPhotoDto'];
export type UploadInspectorPhoto =
  components['schemas']['UploadInspectorPhotoDto'];
export type InspectorKeyCollection =
  components['schemas']['InspectorKeyCollectionResponseDto'];
export type InspectorKeyCustody =
  components['schemas']['InspectorKeyCustodyDto'];
export type RecordKeyCustody = components['schemas']['RecordKeyCustodyDto'];
export type UploadKeyCustodyPhoto =
  components['schemas']['UploadKeyCustodyPhotoDto'];
export type SaveInspectorFindings =
  components['schemas']['SaveInspectorFindingsDto'];
export type ReleaseInspectorInspection =
  components['schemas']['ReleaseInspectorInspectionDto'];
export type InspectorTribunalCaseDto =
  components['schemas']['InspectorTribunalCaseDto'];
export type InspectorProfileDto =
  components['schemas']['InspectorProfileResponseDto'];
export type InspectorRegistrationStatusDto =
  components['schemas']['InspectorRegistrationStatusDto'];
export type SubmitInspectorRegistration =
  components['schemas']['SubmitInspectorRegistrationDto'];
/** One area of a findings submission (the screens build these from their entries). */
export type InspectorFindingAreaPayload =
  SaveInspectorFindings['areas'][number];
// Weekly OPEN batch — the pool screen, the routed plan, and one edited time.
export type OpenBatchOverview = components['schemas']['OpenBatchOverviewDto'];
export type OpenBatchPoolItem = components['schemas']['OpenBatchPoolItemDto'];
export type OpenBatchPlan = components['schemas']['OpenBatchPlanDto'];
export type OpenBatchPlannedStop = components['schemas']['OpenBatchPlannedStopDto'];
export type OpenBatchTimeOverride =
  components['schemas']['OpenBatchTimeOverrideDto'];

function crossubErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const record = error as { message?: unknown };
  const msg = record.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (Array.isArray(msg) && msg.length > 0) {
    return msg.filter((part) => typeof part === 'string').join(', ') || fallback;
  }
  if (msg && typeof msg === 'object') {
    const nested = (msg as { message?: unknown }).message;
    if (typeof nested === 'string' && nested.trim()) return nested;
  }
  return fallback;
}

/** Billable inspection jobs ledger (`GET /api/v1/inspector/jobs`). */
export async function fetchJobs(): Promise<InspectorJob[]> {
  const { data, error } = await crossub.GET('/inspector/jobs');
  if (error || !data) throw new Error('Failed to load jobs');
  return data.items;
}

/** What the board lists under “Pending”; every other status reads as finished. */
const OUTSTANDING_STATUSES: InspectorInspection['status'][] = [
  INSPECTION_STATUS.DRAFT,
  INSPECTION_STATUS.IN_PROGRESS,
];

/**
 * Assigned inspections (`GET /api/v1/inspector/inspections`) — all the live ones.
 *
 * CRS-0103. This one call feeds the whole board: Pending, Completed, the key-access
 * counts and the “Assigned by CROSSUB” badge all read `jobs`, and `jobs` is built from
 * nothing else. It used to ask for no page at all and take the server default of twenty,
 * which is not twenty pieces of *work* — the endpoint returns every non-cancelled
 * inspection this person has ever been put on. On production that meant one inspector
 * holding **823 rows, 79 of them outstanding**, receiving twenty finished jobs and none
 * of the live ones; 77 live jobs were invisible across the roster.
 *
 * **Draining the list is not the fix.** Paging to the end would pull all 823 rows every
 * refresh and hand them to `enrichJobsWithKeyCollection`, which issues a request per
 * uncached job — the same fan-out that once exhausted the browser's connection pool on a
 * 113-job pool. The facade now sorts outstanding work first (`status` ascending), so this
 * takes 100 at a time and **stops as soon as a page ends on finished work**: everything
 * still open is in hand, and the tail of history stays on the server where it belongs.
 * In practice that is a single request, and it degrades gracefully — an inspector with
 * more than a page of live jobs simply gets another page.
 */
export async function fetchInspections(): Promise<InspectorInspection[]> {
  const pageSize = 100; // the facade's ceiling
  const maxPages = 5; // 500 open jobs would be a different problem entirely
  const all: InspectorInspection[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await crossub.GET('/inspector/inspections', {
      params: { query: { page, pageSize } },
    });
    if (error || !data) throw new Error('Failed to load inspections');
    all.push(...data.items);

    const last = data.items[data.items.length - 1];
    if (!data.hasMore || !last || !OUTSTANDING_STATUSES.includes(last.status)) {
      break;
    }
  }
  return all;
}

/** Field inspections claimable from the mobile job pool (excludes CONDITION). */
const POOL_INSPECTION_TYPES = [
  INSPECTION_TYPE.OPEN,
  INSPECTION_TYPE.ROUTINE,
  INSPECTION_TYPE.INGOING,
  INSPECTION_TYPE.OUTGOING,
] as const;

async function fetchPoolInspectionsByType(
  type: (typeof POOL_INSPECTION_TYPES)[number],
  search?: string,
): Promise<InspectorInspection[]> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '/api';
  const trimmed = search?.trim();
  const pageSize = 100;
  // The 15s poll used to walk up to 20 pages for each of 4 types.
  const maxPages = 1;
  const all: InspectorInspection[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      type,
    });
    if (trimmed) params.set('search', trimmed);
    const res = await fetch(`${base}/v1/inspector/inspections/pool?${params}`, {
      credentials: 'include',
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      let detail = 'Failed to load job pool';
      try {
        const body = (await res.json()) as { message?: string | string[] };
        const msg = body.message;
        if (typeof msg === 'string' && msg.trim()) detail = msg;
        else if (Array.isArray(msg) && msg.length > 0) detail = msg.join(', ');
      } catch {
        // Non-JSON error body — keep generic message.
      }
      if (res.status === 403) {
        detail =
          'Your account is not linked to an approved inspector roster yet. Complete registration and ask ops to approve it.';
      } else if (res.status === 401) {
        detail =
          'Session expired or invalid — sign out and sign in again with your inspector account.';
      } else if (res.status === 503) {
        detail = 'API unavailable — start the backend on port 3001 and try again.';
      }
      throw new Error(detail);
    }
    const data = (await res.json()) as {
      items?: InspectorInspection[];
      total?: number;
    };
    const items = data.items ?? [];
    all.push(...items);
    const total = data.total ?? all.length;
    if (items.length === 0 || all.length >= total || items.length < pageSize) {
      break;
    }
    // Property search is already server-filtered — one page is enough when searching.
    if (trimmed) break;
  }

  return all;
}

function mergePoolInspections(
  batches: InspectorInspection[][],
): InspectorInspection[] {
  const byId = new Map<string, InspectorInspection>();
  for (const items of batches) {
    for (const item of items) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const dateA = a.createdAt ?? a.scheduledDate ?? a.inspectionDate ?? '';
    const dateB = b.createdAt ?? b.scheduledDate ?? b.inspectionDate ?? '';
    const byCreated = String(dateB).localeCompare(String(dateA));
    if (byCreated !== 0) return byCreated;
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return 0;
  });
}

/** Unassigned pool inspections (`GET /api/v1/inspector/inspections/pool`). */
export async function fetchPoolInspections(
  search?: string,
): Promise<InspectorInspection[]> {
  const batches = await Promise.all(
    POOL_INSPECTION_TYPES.map((type) => fetchPoolInspectionsByType(type, search)),
  );
  return mergePoolInspections(batches);
}

/** Sync the receiving/on-break toggle with the ops dispatch list (`PATCH /api/v1/inspector/availability`). */
export async function setInspectorPoolAvailability(
  receivingPoolJobs: boolean,
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '/api';
  const res = await fetch(`${base}/v1/inspector/availability`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ receivingPoolJobs }),
  });
  if (!res.ok) {
    let detail = 'Could not sync availability — try again.';
    try {
      const body = (await res.json()) as { message?: string | string[] };
      const msg = body.message;
      if (typeof msg === 'string' && msg.trim()) detail = msg;
      else if (Array.isArray(msg) && msg.length > 0) detail = msg.join(', ');
    } catch {
      // Non-JSON error body — keep generic message.
    }
    if (res.status === 403) {
      detail =
        'Your account is not linked to an approved inspector roster yet. Ask ops to approve your registration.';
    } else if (res.status === 503) {
      detail = 'API unavailable — start the backend on port 3001 and try again.';
    }
    throw new Error(detail);
  }
}

/** Push live GPS to the ops dispatch list (`PATCH /api/v1/inspector/location`). */
export async function setInspectorLocation(
  latitude: number,
  longitude: number,
): Promise<void> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '/api';
  const res = await fetch(`${base}/v1/inspector/location`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latitude, longitude }),
  });
  if (!res.ok) {
    throw new Error('Could not sync location');
  }
}

async function inspectorJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '/api';
  const res = await fetch(`${base}/v1${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    // The bare "Request failed" said nothing about *why*, so an auth or roster problem was
    // indistinguishable from a bug in the screen. Keep the server's message when there is
    // one, and name the common statuses when there is not.
    let detail = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[] };
      const msg = body.message;
      if (typeof msg === 'string' && msg.trim()) detail = msg;
      else if (Array.isArray(msg) && msg.length > 0) detail = msg.join(', ');
    } catch {
      if (res.status === 401) {
        detail = 'Session expired — sign out and sign in again.';
      } else if (res.status === 403) {
        detail =
          'Your account is not linked to an approved inspector roster yet. Ask ops to approve your registration.';
      } else if (res.status === 503) {
        detail = 'API unavailable — start the backend on port 3001 and try again.';
      }
    }
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function fetchInspectorTimetable(
  from: string,
  to: string,
): Promise<InspectorCalendarAvailability> {
  const params = new URLSearchParams({ from, to });
  return inspectorJson<InspectorCalendarAvailability>(`/inspector/timetable?${params}`);
}

export async function saveInspectorTimetable(
  from: string,
  to: string,
  entries: InspectorCalendarAvailability['entries'],
): Promise<InspectorCalendarAvailability> {
  return inspectorJson<InspectorCalendarAvailability>('/inspector/timetable', {
    method: 'PATCH',
    body: JSON.stringify({ from, to, entries }),
  });
}

// ------------------------- Weekly OPEN batch (Miara's flow) -------------------------
//
// Opens are NOT claimed one at a time like the other types. The whole point of the weekly
// batch is that the inspector picks a SET of properties, the API routes them together, and
// only then does a time exist for any of them — claiming three opens individually would
// compute three routes of one stop each and suggest the same 9:00am start for all three.
//
// Every date on these payloads is an ISO instant and must be rendered in Australia/Sydney.
// The handset is often on GMT+8, where a zone-less formatter is silently two hours out in
// a way that still looks like a plausible open time.

/** The OPEN TASK POOL for the Saturday currently being planned. */
export async function fetchOpenBatch(): Promise<OpenBatchOverview> {
  const { data, error } = await crossub.GET('/inspector/inspections/open-batch');
  if (error || !data) {
    throw new Error(crossubErrorMessage(error, 'Could not load the open task pool.'));
  }
  return data;
}

function isEmptyJsonError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: unknown }).message)
        : '';
  return /unexpected end of json input/i.test(message);
}

/**
 * The routed Saturday awaiting confirmation, or null when nothing is selected.
 *
 * The API returns the PERSISTED plan rather than re-planning on read, so the times shown
 * here are exactly the ones a confirm will write. "No plan" is JSON `null` — Nest used
 * to omit the body entirely, and `response.json()` then threw Unexpected end of JSON input
 * which blanked the whole Open Task Pool even though the pool list itself had loaded.
 */
export async function fetchOpenBatchPlan(): Promise<OpenBatchPlan | null> {
  try {
    const { data, error } = await crossub.GET('/inspector/inspections/open-batch/plan');
    if (error) {
      if (isEmptyJsonError(error)) return null;
      throw new Error(crossubErrorMessage(error, 'Could not load your open plan.'));
    }
    return data ?? null;
  } catch (err) {
    if (isEmptyJsonError(err)) return null;
    throw err;
  }
}

/** Submit the selection and get the routed day back (steps 3 + 4). */
export async function selectOpenBatch(
  inspectionIds: string[],
): Promise<OpenBatchPlan> {
  const { data, error } = await crossub.POST('/inspector/inspections/open-batch/select', {
    body: { inspectionIds },
  });
  if (error || !data) {
    throw new Error(crossubErrorMessage(error, 'Could not submit your selection.'));
  }
  return data;
}

/**
 * Confirm the suggested times — or edit them and confirm (step 6).
 *
 * Pass only the stops being moved; anything not listed keeps its suggestion. On success
 * the agent is emailed the confirmed time, which is the first and only moment in this
 * flow that they hear one.
 */
export async function confirmOpenBatch(
  overrides?: OpenBatchTimeOverride[],
): Promise<OpenBatchPlan> {
  const { data, error } = await crossub.POST(
    '/inspector/inspections/open-batch/confirm',
    { body: overrides?.length ? { overrides } : {} },
  );
  if (error || !data) {
    throw new Error(crossubErrorMessage(error, 'Could not confirm your open times.'));
  }
  return data;
}

/** Hand selected opens back to the pool and re-plan what is left. */
export async function releaseOpenBatch(
  inspectionIds: string[],
): Promise<OpenBatchPlan | null> {
  try {
    const { data, error } = await crossub.POST(
      '/inspector/inspections/open-batch/release',
      { body: { inspectionIds } },
    );
    if (error) {
      if (isEmptyJsonError(error)) return null;
      throw new Error(crossubErrorMessage(error, 'Could not release those opens.'));
    }
    return data ?? null;
  } catch (err) {
    if (isEmptyJsonError(err)) return null;
    throw err;
  }
}

/** Claim a pool inspection (`POST /api/v1/inspector/inspections/{inspectionId}/claim`). */
export async function claimInspection(
  inspectionId: string,
): Promise<InspectorInspection> {
  const { data, error } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/claim',
    { params: { path: { inspectionId } } },
  );
  if (error || !data) {
    throw new Error(crossubErrorMessage(error, 'Failed to claim inspection'));
  }
  return data;
}

/** Findings tree for one inspection (`GET /api/v1/inspector/inspections/{inspectionId}/detail`). */
export async function fetchInspectionDetail(
  inspectionId: string,
): Promise<InspectorInspectionDetail> {
  const { data, error } = await crossub.GET(
    '/inspector/inspections/{inspectionId}/detail',
    { params: { path: { inspectionId } } },
  );
  if (error || !data) throw new Error('Failed to load inspection detail');
  return data;
}

/** Leasing key-collection arrangement (`GET /inspector/inspections/{inspectionId}/key-collection`). */
export async function fetchKeyCollection(
  inspectionId: string,
): Promise<InspectorKeyCollection | null> {
  const { data, error, response } = await crossub.GET(
    '/inspector/inspections/{inspectionId}/key-collection',
    { params: { path: { inspectionId } } },
  );
  if (response.status === 404) return null;
  if (error || !data) throw new Error('Failed to load key collection');
  return data;
}

/**
 * Record physical key collection or return on the server
 * (`POST /inspector/inspections/{inspectionId}/key-custody/{collect|return}`).
 * The server enforces the key rules — return requires the inspection to be
 * completed first, and (when required) a proof photo already uploaded.
 */
export async function recordKeyCustody(
  inspectionId: string,
  phase: 'collect' | 'return',
  body: RecordKeyCustody = {},
): Promise<InspectorKeyCustody> {
  if (phase === 'collect') {
    const { data, error } = await crossub.POST(
      '/inspector/inspections/{inspectionId}/key-custody/collect',
      { params: { path: { inspectionId } }, body },
    );
    if (error || !data) {
      throw new Error(crossubErrorMessage(error, 'Failed to record key collection'));
    }
    return data;
  }
  const { data, error } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/key-custody/return',
    { params: { path: { inspectionId } }, body },
  );
  if (error || !data) {
    throw new Error(crossubErrorMessage(error, 'Failed to record key return'));
  }
  return data;
}

/**
 * Upload a key-custody proof photo, base64 → R2, appended to the collect or
 * return proof array (`POST /inspector/inspections/{inspectionId}/key-custody/photos/upload`).
 */
export async function uploadKeyCustodyPhoto(
  inspectionId: string,
  body: UploadKeyCustodyPhoto,
): Promise<InspectorKeyCustody> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/key-custody/photos/upload',
    { params: { path: { inspectionId } }, body },
  );
  if (data) return data;
  if (response.status === 404) {
    throw new Error(
      'Job not assigned to you yet — go back, claim the job, then retry key collection.',
    );
  }
  if (response.status === 413) {
    throw new Error('Photo is too large — try snapping again.');
  }
  throw new Error(crossubErrorMessage(error, 'Failed to upload key proof photo'));
}

/** Accept an inspection (`POST /api/v1/inspector/inspections/{inspectionId}/accept`). */
export async function acceptInspection(
  inspectionId: string,
): Promise<InspectorInspection> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/accept',
    { params: { path: { inspectionId } } },
  );
  if (data) return data;
  // Already IN_PROGRESS — treat as success so key-custody sync can continue.
  if (response.status === 409) {
    const current = await crossub.GET('/inspector/inspections/{inspectionId}', {
      params: { path: { inspectionId } },
    });
    if (current.data) return current.data;
  }
  throw new Error(crossubErrorMessage(error, 'Failed to accept inspection'));
}

/** Complete an inspection (`POST /api/v1/inspector/inspections/{inspectionId}/complete`). */
export async function completeInspection(
  inspectionId: string,
  body: CompleteInspectorInspection,
): Promise<InspectorInspection> {
  const { data, error } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/complete',
    { params: { path: { inspectionId } }, body },
  );
  if (error || !data) {
    throw new Error(crossubErrorMessage(error, 'Failed to complete inspection'));
  }
  return data;
}

/** File the report for an inspection (`POST /api/v1/inspector/inspections/{inspectionId}/report`). */
export async function fileReport(
  inspectionId: string,
  body: FileInspectorReport,
): Promise<InspectorInspection> {
  const { data, error } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/report',
    { params: { path: { inspectionId } }, body },
  );
  if (error || !data) throw new Error('Failed to file report');
  return data;
}

/** Download the filed inspection report PDF for a completed Ingoing / Outgoing / Routine job. */
export async function downloadInspectorReportPdf(
  inspectionId: string,
): Promise<Blob> {
  const base = `${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/v1`;
  const res = await fetch(
    `${base}/inspector/inspections/${encodeURIComponent(inspectionId)}/report/pdf`,
    { credentials: 'include', cache: 'no-store' },
  );
  if (!res.ok) {
    throw new Error(
      await inspectorFetchErrorMessage(res, 'Inspection report is not available yet.'),
    );
  }
  return res.blob();
}

/** Upload an inspection-level evidence photo (`POST /inspector/inspections/{inspectionId}/photos/upload`). */
export async function uploadInspectionPhoto(
  inspectionId: string,
  body: UploadInspectorPhoto,
): Promise<InspectorPhoto> {
  const { data, error } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/photos/upload',
    { params: { path: { inspectionId } }, body },
  );
  if (error || !data) {
    throw new Error(crossubErrorMessage(error, 'Failed to upload photo'));
  }
  return data;
}

async function inspectorFetchErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    const msg = body.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(msg) && msg.length > 0) {
      return msg.filter((part) => typeof part === 'string').join(', ');
    }
  } catch {
    // Non-JSON error body — keep generic message.
  }
  if (res.status === 503) {
    return 'API unavailable — start the backend on port 3001 and try again.';
  }
  return fallback;
}

/** Clear area-level proof photos before the inspector resyncs a room. */
export async function clearInspectionAreaPhotos(
  inspectionId: string,
  areaName: string,
): Promise<void> {
  const base = `${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/v1`;
  const res = await fetch(
    `${base}/inspector/inspections/${inspectionId}/photos/clear-area`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaName }),
    },
  );
  if (!res.ok) {
    throw new Error(
      await inspectorFetchErrorMessage(res, 'Failed to clear area photos'),
    );
  }
}

/** Attach existing hosted photo URLs to an area (no re-upload). */
export async function linkInspectionAreaPhotos(
  inspectionId: string,
  areaName: string,
  urls: string[],
): Promise<InspectorPhoto[]> {
  if (urls.length === 0) return [];
  const base = `${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/v1`;
  const res = await fetch(
    `${base}/inspector/inspections/${inspectionId}/photos/link-area`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaName, urls }),
    },
  );
  if (!res.ok) {
    throw new Error(
      await inspectorFetchErrorMessage(res, 'Failed to link area photos'),
    );
  }
  return (await res.json()) as InspectorPhoto[];
}

/**
 * Persist the findings tree gathered on site
 * (`POST /inspector/inspections/{inspectionId}/findings`). Areas upsert by name
 * within the app's own authorship; items are replaced per area.
 */
export async function saveInspectionFindings(
  inspectionId: string,
  body: SaveInspectorFindings,
): Promise<InspectorInspectionDetail> {
  const { data, error } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/findings',
    { params: { path: { inspectionId } }, body },
  );
  if (error || !data) throw new Error('Failed to save findings');
  return data;
}

export type InspectorDeviceDraftOverlay = {
  deviceId: string;
  kind: 'ingoing' | 'routine' | 'outgoing' | string;
  updatedAt: string;
  draft: Record<string, unknown>;
};

export type InspectorInspectionDetailWithDrafts = InspectorInspectionDetail & {
  executionDrafts?: InspectorDeviceDraftOverlay[];
};

/** Persist this phone’s in-progress walk (`POST .../execution-draft`). */
export async function saveInspectionExecutionDraft(
  inspectionId: string,
  body: {
    deviceId: string;
    kind: 'ingoing' | 'routine' | 'outgoing';
    updatedAt?: string;
    draft: Record<string, unknown>;
  },
): Promise<InspectorInspectionDetailWithDrafts> {
  const base = `${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/v1`;
  const res = await fetch(
    `${base}/inspector/inspections/${inspectionId}/execution-draft`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    throw new Error(
      await inspectorFetchErrorMessage(res, 'Failed to sync inspection draft'),
    );
  }
  return (await res.json()) as InspectorInspectionDetailWithDrafts;
}

/** Decline a pool job (`POST /inspector/inspections/{inspectionId}/decline`). */
export async function declineInspection(
  inspectionId: string,
): Promise<InspectorInspection> {
  const { data, error } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/decline',
    { params: { path: { inspectionId } } },
  );
  if (error || !data) throw new Error('Failed to decline inspection');
  return data;
}

/**
 * Release a claimed/accepted job back to the pool
 * (`POST /inspector/inspections/{inspectionId}/release`).
 */
export async function releaseInspection(
  inspectionId: string,
  body: ReleaseInspectorInspection,
): Promise<InspectorInspection> {
  const { data, error } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/release',
    { params: { path: { inspectionId } }, body },
  );
  if (error || !data) throw new Error('Failed to release inspection');
  return data;
}

/** Tribunal cases assigned to the inspector (`GET /api/v1/inspector/tribunal-cases`). */
export async function fetchInspectorTribunalCases(): Promise<
  InspectorTribunalCaseDto[]
> {
  const { data, error } = await crossub.GET('/inspector/tribunal-cases');
  if (error || !data) throw new Error('Failed to load tribunal cases');
  return data;
}

/** The inspector's own profile + registration status (`GET /api/v1/inspector/profile`). */
export async function fetchInspectorProfile(): Promise<InspectorProfileDto> {
  const { data, error } = await crossub.GET('/inspector/profile');
  if (error || !data) throw new Error('Failed to load profile');
  return data;
}

/**
 * Submit (or resubmit) the inspector's own registration application
 * (`POST /api/v1/inspector/registration`) — lands in the staff review queue.
 */
export async function submitInspectorRegistration(
  body: SubmitInspectorRegistration,
): Promise<InspectorRegistrationStatusDto> {
  const { data, error } = await crossub.POST('/inspector/registration', {
    body,
  });
  if (error || !data) throw new Error('Failed to submit registration');
  return data;
}

/** The inspector's message threads (`GET /api/v1/inspector/messages`). */
export async function fetchInspectorMessages(): Promise<InspectorMessageThread[]> {
  const { data, error } = await crossub.GET('/inspector/messages');
  if (error || !data) throw new Error('Failed to load messages');
  return data;
}

export type CreateInspectorMessageThread =
  components['schemas']['CreateInspectorMessageThreadDto'];
export type SendInspectorMessage =
  components['schemas']['SendInspectorMessageDto'];

/** Open a new thread (`POST /api/v1/inspector/messages`). */
export async function createInspectorMessage(
  body: CreateInspectorMessageThread,
): Promise<InspectorMessageThread> {
  const { data, error } = await crossub.POST('/inspector/messages', { body });
  if (error || !data) throw new Error('Failed to create message thread');
  return data;
}

/** Reply to a thread (`POST /api/v1/inspector/messages/{threadId}/reply`). */
export async function replyInspectorMessage(
  threadId: string,
  body: SendInspectorMessage,
): Promise<InspectorMessageThread> {
  const { data, error } = await crossub.POST(
    '/inspector/messages/{threadId}/reply',
    { params: { path: { threadId } }, body },
  );
  if (error || !data) throw new Error('Failed to send message');
  return data;
}

/** The inspector's notifications (`GET /api/v1/inspector/notifications`). */
export async function fetchInspectorNotifications(): Promise<
  InspectorNotificationDto[]
> {
  const { data, error } = await crossub.GET('/inspector/notifications');
  if (error || !data) throw new Error('Failed to load notifications');
  return data;
}

/** Mark one notification read (`PATCH /api/v1/inspector/notifications/{notificationId}/read`). */
export async function markInspectorNotificationRead(
  notificationId: string,
): Promise<InspectorNotificationDto> {
  const { data, error } = await crossub.PATCH(
    '/inspector/notifications/{notificationId}/read',
    { params: { path: { notificationId } } },
  );
  if (error || !data) throw new Error('Failed to mark notification read');
  return data;
}

/** Mark all notifications read (`POST /api/v1/inspector/notifications/read-all`). */
export async function markAllInspectorNotificationsRead(): Promise<{
  updated: number;
}> {
  const { data, error } = await crossub.POST(
    '/inspector/notifications/read-all',
  );
  if (error || !data) throw new Error('Failed to mark all notifications read');
  return data;
}
