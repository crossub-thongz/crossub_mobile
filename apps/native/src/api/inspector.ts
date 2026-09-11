import type { components } from '@crossub-thongz/api-contract';

import { apiErrorMessage, crossub } from '@/src/api/client';
import {
  INSPECTION_STATUS,
  OUTSTANDING_STATUSES,
  POOL_INSPECTION_TYPES,
} from '@/src/constants/inspections';

export type InspectorInspection =
  components['schemas']['InspectorInspectionResponseDto'];
export type InspectorInspectionDetail =
  components['schemas']['InspectorInspectionDetailDto'];
export type InspectorPhoto = components['schemas']['InspectorPhotoDto'];
export type SaveInspectorFindings =
  components['schemas']['SaveInspectorFindingsDto'];
export type UploadInspectorPhoto =
  components['schemas']['UploadInspectorPhotoDto'];
export type CompleteInspectorInspection =
  components['schemas']['CompleteInspectorInspectionDto'];
export type OpenBatchOverview = components['schemas']['OpenBatchOverviewDto'];
export type OpenBatchPoolItem = components['schemas']['OpenBatchPoolItemDto'];
export type OpenBatchPlan = components['schemas']['OpenBatchPlanDto'];
export type OpenBatchPlannedStop = components['schemas']['OpenBatchPlannedStopDto'];
export type OpenBatchTimeOverride = components['schemas']['OpenBatchTimeOverrideDto'];
export type InspectorProfileDto = components['schemas']['InspectorProfileResponseDto'];
export type InspectorRegistrationStatusDto =
  components['schemas']['InspectorRegistrationStatusDto'];
export type SubmitInspectorRegistration =
  components['schemas']['SubmitInspectorRegistrationDto'];
export type InspectorCalendarAvailability =
  components['schemas']['InspectorCalendarAvailabilityView'];
export type InspectorJob = components['schemas']['InspectorJobResponseDto'];
export type InspectorTribunalCaseDto =
  components['schemas']['InspectorTribunalCaseDto'];
export type InspectionDraftKind = 'ingoing' | 'routine' | 'outgoing';
export type FindingRating = NonNullable<
  components['schemas']['InspectorFindingAreaInput']['rating']
>;

type OutstandingStatus = (typeof OUTSTANDING_STATUSES)[number];

function isOutstanding(
  status: InspectorInspection['status'],
): status is OutstandingStatus {
  return (OUTSTANDING_STATUSES as readonly string[]).includes(status);
}

function throwIfFailed(
  error: unknown,
  response: { status: number },
  fallback: string,
): never {
  if (response.status === 403) {
    throw new Error(
      'Your account is not linked to an approved inspector roster yet. Complete registration and ask ops to approve it.',
    );
  }
  if (response.status === 401) {
    throw new Error('Session expired. Sign out and sign in again.');
  }
  throw new Error(apiErrorMessage(error, fallback));
}

export function inspectionDraftKind(
  type: InspectorInspection['type'],
): InspectionDraftKind {
  if (type === 'INGOING') return 'ingoing';
  if (type === 'OUTGOING') return 'outgoing';
  return 'routine';
}

/** Assigned inspections (`GET /api/v1/inspector/inspections`). Outstanding first, then stop. */
export async function fetchInspections(): Promise<InspectorInspection[]> {
  const pageSize = 100;
  const maxPages = 5;
  const all: InspectorInspection[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error, response } = await crossub.GET('/inspector/inspections', {
      params: { query: { page, pageSize } },
    });
    if (error || !data) {
      throwIfFailed(error, response, 'Failed to load inspections');
    }
    all.push(...data.items);
    if (!data.hasMore || data.items.length === 0 || data.items.length < pageSize) break;
  }
  return all;
}

async function fetchPoolInspectionsByType(
  type: (typeof POOL_INSPECTION_TYPES)[number],
): Promise<InspectorInspection[]> {
  const pageSize = 100;
  const maxPages = 20;
  const all: InspectorInspection[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error, response } = await crossub.GET(
      '/inspector/inspections/pool',
      { params: { query: { page, pageSize, type } } },
    );
    if (error || !data) {
      throwIfFailed(error, response, 'Failed to load job pool');
    }
    all.push(...data.items);
    if (!data.hasMore || data.items.length === 0 || data.items.length < pageSize) {
      break;
    }
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
export async function fetchPoolInspections(): Promise<InspectorInspection[]> {
  const batches = await Promise.all(
    POOL_INSPECTION_TYPES.map((type) => fetchPoolInspectionsByType(type)),
  );
  return mergePoolInspections(batches);
}

/** Claim a pool inspection (`POST /api/v1/inspector/inspections/{id}/claim`). */
export async function claimInspection(
  inspectionId: string,
): Promise<InspectorInspection> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/claim',
    { params: { path: { inspectionId } } },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to claim inspection');
  }
  return data;
}

export function isOutstandingInspection(item: InspectorInspection): boolean {
  return isOutstanding(item.status);
}

export function isCancelledInspection(item: InspectorInspection): boolean {
  return item.status === INSPECTION_STATUS.CANCELLED;
}

export function isEditableInspection(item: InspectorInspection): boolean {
  return (
    item.status === INSPECTION_STATUS.DRAFT ||
    item.status === INSPECTION_STATUS.IN_PROGRESS
  );
}

/** One assigned inspection (`GET /api/v1/inspector/inspections/{id}`). */
export async function fetchInspection(
  inspectionId: string,
): Promise<InspectorInspection> {
  const { data, error, response } = await crossub.GET(
    '/inspector/inspections/{inspectionId}',
    { params: { path: { inspectionId } } },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to load inspection');
  }
  return data;
}

/** Findings tree (`GET /api/v1/inspector/inspections/{id}/detail`). */
export async function fetchInspectionDetail(
  inspectionId: string,
): Promise<InspectorInspectionDetail> {
  const { data, error, response } = await crossub.GET(
    '/inspector/inspections/{inspectionId}/detail',
    { params: { path: { inspectionId } } },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to load inspection detail');
  }
  return data;
}

/** Accept DRAFT to IN_PROGRESS. 409 (already in progress) is treated as success. */
export async function acceptInspection(
  inspectionId: string,
): Promise<InspectorInspection> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/accept',
    { params: { path: { inspectionId } } },
  );
  if (data) return data;
  if (response.status === 409) {
    return fetchInspection(inspectionId);
  }
  throwIfFailed(error, response, 'Failed to accept inspection');
}

/** Persist findings (`POST .../findings`). */
export async function saveInspectionFindings(
  inspectionId: string,
  body: SaveInspectorFindings,
): Promise<InspectorInspectionDetail> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/findings',
    { params: { path: { inspectionId } }, body },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to save findings');
  }
  return data;
}

/** Best-effort device overlay (`POST .../execution-draft`). */
export async function saveInspectionExecutionDraft(
  inspectionId: string,
  body: {
    deviceId: string;
    kind: InspectionDraftKind;
    updatedAt?: string;
    draft: Record<string, unknown>;
  },
): Promise<void> {
  const { error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/execution-draft',
    { params: { path: { inspectionId } }, body },
  );
  if (error) {
    throwIfFailed(error, response, 'Failed to sync inspection draft');
  }
}

/** Base64 evidence photo (`POST .../photos/upload`). */
export async function uploadInspectionPhoto(
  inspectionId: string,
  body: UploadInspectorPhoto,
): Promise<InspectorPhoto> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/photos/upload',
    { params: { path: { inspectionId } }, body },
  );
  if (data) return data;
  if (response.status === 413) {
    throw new Error('Photo is too large. Try snapping again.');
  }
  throwIfFailed(error, response, 'Failed to upload photo');
}

/** Complete IN_PROGRESS to COMPLETED (`POST .../complete`). */
export async function completeInspection(
  inspectionId: string,
  body: CompleteInspectorInspection,
): Promise<InspectorInspection> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/complete',
    { params: { path: { inspectionId } }, body },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to complete inspection');
  }
  return data;
}

export type InspectorKeyCollection =
  components['schemas']['InspectorKeyCollectionResponseDto'];
export type InspectorKeyCustody = components['schemas']['InspectorKeyCustodyDto'];

export async function fetchKeyCollection(
  inspectionId: string,
): Promise<InspectorKeyCollection | null> {
  const { data, error, response } = await crossub.GET(
    '/inspector/inspections/{inspectionId}/key-collection',
    { params: { path: { inspectionId } } },
  );
  if (response.status === 404) return null;
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to load key collection');
  }
  return data;
}

export async function declineInspection(
  inspectionId: string,
): Promise<InspectorInspection> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/decline',
    { params: { path: { inspectionId } } },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to decline inspection');
  }
  return data;
}

export async function recordKeyCustody(
  inspectionId: string,
  phase: 'collect' | 'return',
): Promise<InspectorKeyCustody> {
  const path =
    phase === 'collect'
      ? '/inspector/inspections/{inspectionId}/key-custody/collect'
      : '/inspector/inspections/{inspectionId}/key-custody/return';
  const { data, error, response } = await crossub.POST(path, {
    params: { path: { inspectionId } },
    body: {},
  });
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to record key custody');
  }
  return data;
}

export async function uploadKeyCustodyPhoto(
  inspectionId: string,
  body: {
    phase: 'collect' | 'return';
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    contentBase64: string;
  },
): Promise<InspectorKeyCustody> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/{inspectionId}/key-custody/photos/upload',
    { params: { path: { inspectionId } }, body },
  );
  if (data) return data;
  if (response.status === 413) {
    throw new Error('Photo is too large. Try snapping again.');
  }
  throwIfFailed(error, response, 'Failed to upload key proof photo');
}

export type InspectorMessageThread =
  components['schemas']['InspectorMessageThreadResponseDto'];
export type InspectorNotificationDto =
  components['schemas']['InspectorNotificationResponseDto'];
export type CreateInspectorMessageThread =
  components['schemas']['CreateInspectorMessageThreadDto'];
export type SendInspectorMessage =
  components['schemas']['SendInspectorMessageDto'];

export async function fetchInspectorMessages(): Promise<InspectorMessageThread[]> {
  const { data, error, response } = await crossub.GET('/inspector/messages');
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to load messages');
  }
  return data;
}

export async function createInspectorMessage(
  body: CreateInspectorMessageThread,
): Promise<InspectorMessageThread> {
  const { data, error, response } = await crossub.POST('/inspector/messages', { body });
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to create message thread');
  }
  return data;
}

export async function replyInspectorMessage(
  threadId: string,
  body: SendInspectorMessage,
): Promise<InspectorMessageThread> {
  const { data, error, response } = await crossub.POST(
    '/inspector/messages/{threadId}/reply',
    { params: { path: { threadId } }, body },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to send message');
  }
  return data;
}

export async function fetchInspectorNotifications(): Promise<InspectorNotificationDto[]> {
  const { data, error, response } = await crossub.GET('/inspector/notifications');
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to load notifications');
  }
  return data;
}

export async function markInspectorNotificationRead(
  notificationId: string,
): Promise<InspectorNotificationDto> {
  const { data, error, response } = await crossub.PATCH(
    '/inspector/notifications/{notificationId}/read',
    { params: { path: { notificationId } } },
  );
  if (error || !data) {
  throwIfFailed(error, response, 'Failed to mark notification read');
  }
  return data;
}

/** Ops dispatch ping (`PATCH /api/v1/inspector/location`). */
export async function setInspectorLocation(
  latitude: number,
  longitude: number,
): Promise<void> {
  const { error, response } = await crossub.PATCH('/inspector/location', {
    body: { latitude, longitude },
  });
  if (error) {
    throwIfFailed(error, response, 'Could not sync location');
  }
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

/** Weekly OPEN pool (`GET /api/v1/inspector/inspections/open-batch`). */
export async function fetchOpenBatch(): Promise<OpenBatchOverview> {
  const { data, error, response } = await crossub.GET(
    '/inspector/inspections/open-batch',
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Could not load the open task pool.');
  }
  return data;
}

/** Persisted Saturday plan, or null when nothing is selected. */
export async function fetchOpenBatchPlan(): Promise<OpenBatchPlan | null> {
  try {
    const { data, error, response } = await crossub.GET(
      '/inspector/inspections/open-batch/plan',
    );
    if (error) {
      if (isEmptyJsonError(error)) return null;
      throwIfFailed(error, response, 'Could not load your open plan.');
    }
    return data ?? null;
  } catch (err) {
    if (isEmptyJsonError(err)) return null;
    throw err;
  }
}

/** Submit the set together so the route (and every suggested time) is for the whole day. */
export async function selectOpenBatch(inspectionIds: string[]): Promise<OpenBatchPlan> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/open-batch/select',
    { body: { inspectionIds } },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Could not submit your selection.');
  }
  return data;
}

/** Confirm suggested times, or send only the stops being moved. */
export async function confirmOpenBatch(
  overrides?: OpenBatchTimeOverride[],
): Promise<OpenBatchPlan> {
  const { data, error, response } = await crossub.POST(
    '/inspector/inspections/open-batch/confirm',
    { body: overrides?.length ? { overrides } : {} },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Could not confirm your open times.');
  }
  return data;
}

/** Hand selected opens back to the pool and re-plan what is left. */
export async function releaseOpenBatch(
  inspectionIds: string[],
): Promise<OpenBatchPlan | null> {
  try {
    const { data, error, response } = await crossub.POST(
      '/inspector/inspections/open-batch/release',
      { body: { inspectionIds } },
    );
    if (error) {
      if (isEmptyJsonError(error)) return null;
      throwIfFailed(error, response, 'Could not release those opens.');
    }
    return data ?? null;
  } catch (err) {
    if (isEmptyJsonError(err)) return null;
    throw err;
  }
}

/** Profile + registration (`GET /api/v1/inspector/profile`). */
export async function fetchInspectorProfile(): Promise<InspectorProfileDto> {
  const { data, error, response } = await crossub.GET('/inspector/profile');
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to load profile');
  }
  return data;
}

/** Submit or resubmit the registration application. */
export async function submitInspectorRegistration(
  body: SubmitInspectorRegistration,
): Promise<InspectorRegistrationStatusDto> {
  const { data, error, response } = await crossub.POST('/inspector/registration', {
    body,
  });
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to submit registration');
  }
  return data;
}

export async function fetchInspectorTimetable(
  from: string,
  to: string,
): Promise<InspectorCalendarAvailability> {
  const { data, error, response } = await crossub.GET('/inspector/timetable', {
    params: { query: { from, to } },
  });
  if (error || !data) {
    throwIfFailed(error, response, 'Could not load availability');
  }
  return data;
}

export async function saveInspectorTimetable(
  from: string,
  to: string,
  entries: InspectorCalendarAvailability['entries'],
): Promise<InspectorCalendarAvailability> {
  const { data, error, response } = await crossub.PATCH('/inspector/timetable', {
    body: { from, to, entries },
  });
  if (error || !data) {
    throwIfFailed(error, response, 'Could not save availability');
  }
  return data;
}

/** Billable attendances ledger (`GET /api/v1/inspector/jobs`). */
export async function fetchInspectorJobs(): Promise<InspectorJob[]> {
  const pageSize = 100;
  const maxPages = 5;
  const all: InspectorJob[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error, response } = await crossub.GET('/inspector/jobs', {
      params: { query: { page, pageSize } },
    });
    if (error || !data) {
      throwIfFailed(error, response, 'Failed to load earnings');
    }
    all.push(...data.items);
    if (!data.hasMore || data.items.length === 0 || data.items.length < pageSize) break;
  }
  return all;
}

/** Assigned tribunal hearings (`GET /api/v1/inspector/tribunal-cases`). */
export async function fetchInspectorTribunalCases(): Promise<InspectorTribunalCaseDto[]> {
  const { data, error, response } = await crossub.GET('/inspector/tribunal-cases');
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to load tribunal cases');
  }
  return data;
}

export async function fetchInspectorTribunalCase(
  caseId: string,
): Promise<InspectorTribunalCaseDto> {
  const { data, error, response } = await crossub.GET(
    '/inspector/tribunal-cases/{caseId}',
    { params: { path: { caseId } } },
  );
  if (error || !data) {
    throwIfFailed(error, response, 'Failed to load tribunal case');
  }
  return data;
}
