/**
 * Pure adapters from the typed CROSSUB inspector facade DTOs
 * (`@crossub-thongz/api-contract`) to the view-models the inspector screens already
 * render (`lib/types.ts`). Keeping the translation here means the screens stay agnostic
 * about where their data came from — the provider overlays these mapped results onto the
 * demo seeds with no component changes.
 *
 * Two facade surfaces map here:
 *   - `/inspector/inspections` (assigned work)  -> InspectionJob
 *   - `/inspector/jobs`        (billable ledger) -> EarningsRecord
 * Both are THIN projections of the real Prisma rows, so view-model fields the facade
 * does not carry (geo, contacts, key access, property spec) land on safe defaults — the
 * same shape the screens already tolerate for demo data.
 */
import {
  BILLING_SOURCE,
  CONDITION_RATING_LABEL,
  INSPECTION_STATUS,
  INSPECTION_TYPE,
  INSPECTOR_NOTIFICATION_TYPE,
  INVOICE_STATUS,
  TRIBUNAL_TYPE_LABEL,
} from '@/constants/api-enums';
import {
  INSPECTOR_HOURLY_RATE_AUD,
  ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD,
  TRIBUNAL_OUTCOMES,
} from '@/constants/inspection';
import { inspectionAwaitingOfficerApproval } from '@/constants/inspection-approval';
import { calculateJobPay } from '@/lib/inspector-pay';
import type { LabeledPhoto } from '@/lib/job-history';
import type {
  EarningsRecord,
  InspectionJob,
  InspectionType,
  InspectorNotification,
  InspectorRegistration,
  JobStatus,
  MessageThread,
  PropertyInspectionSpec,
  RoomInspectionEntry,
  ServiceRegionKey,
  ThreadMessage,
  TribunalHearing,
  TribunalOutcome,
} from '@/lib/types';

import type {
  InspectorInspection,
  InspectorInspectionDetail,
  InspectorJob,
  InspectorMessageThread,
  InspectorNotificationDto,
  InspectorRegistrationStatusDto,
  InspectorTribunalCaseDto,
} from './inspector-client';

/**
 * The generated contract types nullable columns inconsistently — some surface as
 * `T | Record<string, never>` rather than `T | null` (an openapi-typescript rendering of
 * a `nullable: true` schema with no explicit `type`). So every scalar we read is funnelled
 * through these guards to land a clean primitive or null, never a stray `{}`.
 */
function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** API InspectionType vocabulary -> the app's field-inspection types. */
const INSPECTION_TYPE_VIEW: Record<InspectorInspection['type'], InspectionType> = {
  [INSPECTION_TYPE.OPEN]: 'open',
  [INSPECTION_TYPE.INGOING]: 'ingoing',
  [INSPECTION_TYPE.OUTGOING]: 'outgoing',
  [INSPECTION_TYPE.ROUTINE]: 'routine',
  [INSPECTION_TYPE.CONDITION]: 'routine',
  [INSPECTION_TYPE.WARD_ROUND]: 'routine',
};

/**
 * API InspectionStatus -> the app's JobStatus. The persisted model has a review/publish
 * tail the mobile board collapses into "completed"; DRAFT reads as "assigned" so the
 * Accept action shows, and accept drives DRAFT→IN_PROGRESS on the real facade.
 */
const INSPECTION_STATUS_VIEW: Record<InspectorInspection['status'], JobStatus> = {
  [INSPECTION_STATUS.DRAFT]: 'assigned',
  [INSPECTION_STATUS.IN_PROGRESS]: 'in_progress',
  [INSPECTION_STATUS.FIRST_REVIEW]: 'completed',
  [INSPECTION_STATUS.SECOND_REVIEW]: 'completed',
  [INSPECTION_STATUS.COMPLETED]: 'completed',
  [INSPECTION_STATUS.PUBLISHED]: 'completed',
  [INSPECTION_STATUS.CANCELLED]: 'declined',
};

function mapInspectionJobStatus(
  dto: InspectorInspection,
  type: InspectionType,
): JobStatus {
  const approvedAt = asString((dto as { approvedAt?: unknown }).approvedAt);
  const declineReason = asString(
    (dto as { reportDeclineReason?: unknown }).reportDeclineReason,
  );
  const completedAt =
    asString((dto as { completedDate?: unknown }).completedDate) ??
    asString((dto as { inspectionDate?: unknown }).inspectionDate);
  const pendingReview =
    (type === 'ingoing' || type === 'outgoing') &&
    !approvedAt &&
    !declineReason &&
    (dto.status === INSPECTION_STATUS.COMPLETED ||
      dto.status === INSPECTION_STATUS.FIRST_REVIEW ||
      dto.status === INSPECTION_STATUS.SECOND_REVIEW) &&
    inspectionAwaitingOfficerApproval({ completedAt, approvedAt: null });
  if (pendingReview) return 'awaiting_approval';
  return INSPECTION_STATUS_VIEW[dto.status] ?? 'assigned';
}

/** API BillingSource -> the app's InspectionType label for an earnings line. */
const BILLING_SOURCE_VIEW: Record<InspectorJob['source'], InspectionType> = {
  [BILLING_SOURCE.ROUTINE_INSPECTION]: 'routine',
  [BILLING_SOURCE.TRIBUNAL]: 'tribunal',
};

/**
 * BillableAttendance.source is ROUTINE_INSPECTION for every field inspection type
 * (open / ingoing / outgoing / routine). The real type lives in sourceLabel:
 * "Open Inspection — …", "Ingoing Inspection — …", etc.
 */
function earningsTypeFromJob(dto: InspectorJob): InspectionType {
  if (dto.source === BILLING_SOURCE.TRIBUNAL) return 'tribunal';
  const label = asString(dto.sourceLabel)?.toLowerCase() ?? '';
  if (label.startsWith('open inspection')) return 'open';
  if (label.startsWith('ingoing inspection')) return 'ingoing';
  if (label.startsWith('outgoing inspection')) return 'outgoing';
  if (label.startsWith('routine inspection')) return 'routine';
  return BILLING_SOURCE_VIEW[dto.source] ?? 'routine';
}

const DEFAULT_REGION: ServiceRegionKey = 'cbd_inner';

function propertySpecFromDto(dto: InspectorInspection): PropertyInspectionSpec {
  const extra = dto as {
    propertyBedrooms?: unknown;
    propertyBathrooms?: unknown;
    propertyType?: unknown;
  };
  const bedrooms = asNumber(extra.propertyBedrooms) ?? 1;
  const bathrooms = asNumber(extra.propertyBathrooms) ?? 1;
  const type = asString(extra.propertyType)?.toUpperCase();
  if (type === 'HOUSE' || type === 'TOWNHOUSE') {
    return {
      propertyKind: 'house',
      bedrooms,
      bathrooms,
      livingAreas: 1,
      kitchens: 1,
      laundries: 1,
      hasYard: false,
    };
  }
  return { propertyKind: 'apartment', bedrooms, bathrooms };
}

/** Map one assigned inspection (thin facade DTO) onto the app's InspectionJob card. */
export function toInspectionJob(dto: InspectorInspection): InspectionJob {
  const type = INSPECTION_TYPE_VIEW[dto.type] ?? 'routine';
  const scheduled =
    asString(dto.scheduledDate) ??
    asString(dto.inspectionDate) ??
    asString(dto.createdAt) ??
    '';
  const property = propertySpecFromDto(dto);
  const pay = calculateJobPay(property, 0, type);
  const propertyLatitude = asNumber(
    (dto as { propertyLatitude?: unknown }).propertyLatitude,
  );
  const propertyLongitude = asNumber(
    (dto as { propertyLongitude?: unknown }).propertyLongitude,
  );
  const hasPropertyGeo =
    propertyLatitude != null && propertyLongitude != null;
  const availableInspectorCount = asNumber(
    (dto as { availableInspectorCount?: unknown }).availableInspectorCount,
  );
  const reportDeclineReason = asString(
    (dto as { reportDeclineReason?: unknown }).reportDeclineReason,
  );
  const approvedAt = asString((dto as { approvedAt?: unknown }).approvedAt);
  const reportUrl = asString((dto as { reportUrl?: unknown }).reportUrl);
  const awaitingAgentPayment = Boolean(
    (dto as { awaitingAgentPayment?: unknown }).awaitingAgentPayment,
  );
  const assignedByStaff = Boolean(
    (dto as { assignedByStaff?: unknown }).assignedByStaff,
  );
  const extra = dto as {
    propertyImageUrl?: unknown;
    tenantName?: unknown;
    tenantPhone?: unknown;
    tenantEmail?: unknown;
    agentName?: unknown;
    agentCompany?: unknown;
    agentEmail?: unknown;
    agentPhone?: unknown;
    leaseStart?: unknown;
    leaseStartDate?: unknown;
    leaseEnd?: unknown;
    leaseEndDate?: unknown;
  };
  const propertyImageUrl = asString(extra.propertyImageUrl);
  const tenantName = asString(extra.tenantName);
  const tenantPhone = asString(extra.tenantPhone);
  const tenantEmail = asString(extra.tenantEmail);
  const agentName = asString(extra.agentName);
  const agentCompany = asString(extra.agentCompany);
  const agentEmail = asString(extra.agentEmail);
  const agentPhone = asString(extra.agentPhone);
  const leaseStart = asString(extra.leaseStart) ?? asString(extra.leaseStartDate);
  const leaseEnd = asString(extra.leaseEnd) ?? asString(extra.leaseEndDate);
  return {
    id: dto.id,
    type,
    propertyAddress: asString(dto.propertyAddress) ?? 'Assigned property',
    suburb: asString(dto.propertySuburb) ?? '',
    ...(hasPropertyGeo
      ? { latitude: propertyLatitude, longitude: propertyLongitude }
      : {}),
    ...(propertyImageUrl ? { propertyImageUrl } : {}),
    ...(tenantName ? { tenantName } : {}),
    ...(tenantPhone ? { tenantPhone } : {}),
    ...(tenantEmail ? { tenantEmail } : {}),
    ...(agentName ? { agentName } : {}),
    ...(agentCompany ? { agentCompany } : {}),
    ...(agentEmail ? { agentEmail } : {}),
    ...(agentPhone ? { agentPhone } : {}),
    ...(leaseStart ? { leaseStart } : {}),
    ...(leaseEnd ? { leaseEnd } : {}),
    scheduledDate: scheduled,
    scheduledTime: scheduled,
    createdAt: asString(dto.createdAt) ?? undefined,
    priority: dto.urgent ? 'urgent' : 'normal',
    distanceKm: 0,
    status: mapInspectionJobStatus(dto, type),
    source: 'assigned',
    ...(assignedByStaff ? { assignedBy: 'CROSSUB' } : {}),
    serviceRegion: DEFAULT_REGION,
    property,
    durationLabel: `Approx. ${pay.estimatedHours} hr${pay.estimatedHours === 1 ? '' : 's'}`,
    travelKmOneWay: 0,
    estimatedHours: pay.estimatedHours,
    laborAmount: pay.laborAmount,
    fuelAllowance: pay.fuelAllowance,
    payAmount: pay.payAmount,
    availableInspectorCount,
    ...(reportDeclineReason ? { reportDeclineReason } : {}),
    ...(approvedAt ? { approvedAt } : {}),
    ...(reportUrl ? { reportUrl } : {}),
    ...(awaitingAgentPayment ? { awaitingAgentPayment: true } : {}),
  };
}

export function mapInspections(dtos: InspectorInspection[]): InspectionJob[] {
  return dtos.map(toInspectionJob);
}

/** Map pool rows onto claimable jobs (`status: available`, `source: pool`). */
export function toPoolInspectionJob(dto: InspectorInspection): InspectionJob {
  return {
    ...toInspectionJob(dto),
    status: 'available',
    source: 'pool',
  };
}

export function mapPoolInspections(dtos: InspectorInspection[]): InspectionJob[] {
  return dtos
    .filter((dto) => !Boolean((dto as { assignedByStaff?: unknown }).assignedByStaff))
    .map(toPoolInspectionJob);
}

/** Map one billable attendance (thin facade DTO) onto the app's EarningsRecord. */
export function toEarningsRecord(dto: InspectorJob): EarningsRecord {
  const type = earningsTypeFromJob(dto);
  const apiAmount = asNumber(dto.totalAmount) ?? 0;
  const apiHours = asNumber(dto.billableHours) ?? 0;
  const rate = asNumber(dto.hourlyRate) ?? INSPECTOR_HOURLY_RATE_AUD;
  const flatRoutineOpen = type === 'routine' || type === 'open';
  const laborAmount = flatRoutineOpen
    ? ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD
    : apiAmount;
  const hoursWorked = flatRoutineOpen ? 1 : apiHours;
  return {
    id: dto.id,
    jobId: dto.id,
    type,
    propertyAddress: asString(dto.propertyLabel) ?? dto.sourceLabel,
    completedAt: asString(dto.submittedAt) ?? asString(dto.endTime) ?? '',
    hoursWorked,
    hourlyRate: rate,
    travelKmOneWay: 0,
    fuelAllowance: 0,
    laborAmount,
    amount: laborAmount,
    // PENDING = not yet pushed to accounting; INVOICED/PAID = synced.
    accountingSynced: dto.invoiceStatus !== INVOICE_STATUS.PENDING,
  };
}

export function mapInspectorEarnings(dtos: InspectorJob[]): EarningsRecord[] {
  return dtos.map(toEarningsRecord);
}

/** Map the API's ConditionRating enum to its display label, falling back to the raw code. */
function conditionLabel(rating: string): string {
  return (
    CONDITION_RATING_LABEL[rating as keyof typeof CONDITION_RATING_LABEL] ??
    rating
  );
}

const INGOING_AREA_SUFFIX = / \(Ingoing\)$/;
const OUTGOING_AREA_SUFFIX = / \(Outgoing\)$/;

function isPersistedPhotoUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function areaComments(area: InspectorInspectionDetail['areas'][number]): string {
  return area.items
    .map((item) => {
      const name = asString(item.name);
      const tags = (item.conditionTags ?? [])
        .map((tag) => asString(tag))
        .filter((tag): tag is string => Boolean(tag));
      const detail = asString(item.comment) || tags.join(' · ');
      if (!detail) return null;
      if (name && name.toLowerCase() !== 'notes' && name.toLowerCase() !== 'issue') {
        return `${name}: ${detail}`;
      }
      return detail;
    })
    .filter((c): c is string => c !== null)
    .join(' · ');
}

function areaPhotoUrls(area: InspectorInspectionDetail['areas'][number]): string[] {
  return [
    ...area.photos.map((photo) => photo.url),
    ...area.items.flatMap((item) => item.photos.map((photo) => photo.url)),
  ].filter(isPersistedPhotoUrl);
}

function mapSingleArea(
  area: InspectorInspectionDetail['areas'][number],
): RoomInspectionEntry {
  const photoUrls = areaPhotoUrls(area);
  return {
    area: asString(area.name) ?? 'Unnamed area',
    condition: asString(area.ratingRaw) ?? conditionLabel(area.rating),
    comments: areaComments(area),
    photoCount: photoUrls.length,
    photoUrls,
  };
}

function mapOutgoingInspectionDetail(
  dto: InspectorInspectionDetail,
): RoomInspectionEntry[] {
  type Bucket = {
    ingoingPhotoUrls: string[];
    outgoingPhotoUrls: string[];
    comments: string;
  };

  const grouped = new Map<string, Bucket>();

  const bucketFor = (room: string): Bucket =>
    grouped.get(room) ?? {
      ingoingPhotoUrls: [],
      outgoingPhotoUrls: [],
      comments: '',
    };

  for (const area of dto.areas) {
    const name = asString(area.name) ?? '';
    const photos = areaPhotoUrls(area);
    const comments = areaComments(area);

    if (INGOING_AREA_SUFFIX.test(name)) {
      const room = name.replace(INGOING_AREA_SUFFIX, '');
      const bucket = bucketFor(room);
      bucket.ingoingPhotoUrls.push(...photos);
      grouped.set(room, bucket);
      continue;
    }

    if (OUTGOING_AREA_SUFFIX.test(name)) {
      const room = name.replace(OUTGOING_AREA_SUFFIX, '');
      const bucket = bucketFor(room);
      bucket.outgoingPhotoUrls.push(...photos);
      if (comments) bucket.comments = comments;
      grouped.set(room, bucket);
      continue;
    }

    const bucket = bucketFor(name);
    if (comments) bucket.comments = comments;
    if (photos.length > 0) {
      bucket.outgoingPhotoUrls.push(...photos);
    }
    grouped.set(name, bucket);
  }

  return [...grouped.entries()]
    .map(([area, bucket]) => ({
      area,
      condition: '',
      comments: bucket.comments,
      photoCount: bucket.ingoingPhotoUrls.length + bucket.outgoingPhotoUrls.length,
      photoUrls: [...bucket.ingoingPhotoUrls, ...bucket.outgoingPhotoUrls],
      ingoingPhotoUrls: bucket.ingoingPhotoUrls,
      outgoingPhotoUrls: bucket.outgoingPhotoUrls,
    }))
    .filter(
      (row) =>
        row.ingoingPhotoUrls.length > 0 ||
        row.outgoingPhotoUrls.length > 0 ||
        Boolean(row.comments),
    );
}

/**
 * Flatten the findings tree (areas → items → photos, plus inspection-level photos) onto
 * the flat per-room rows the read view renders. Outgoing jobs merge `Entry (Ingoing)` /
 * `Entry (Outgoing)` into one side-by-side row and drop empty duplicate bare area names.
 */
export function mapInspectionDetail(
  dto: InspectorInspectionDetail,
): RoomInspectionEntry[] {
  const hasOutgoingStyle = dto.areas.some((area) => {
    const name = asString(area.name) ?? '';
    return INGOING_AREA_SUFFIX.test(name) || OUTGOING_AREA_SUFFIX.test(name);
  });

  if (hasOutgoingStyle) {
    return mapOutgoingInspectionDetail(dto);
  }

  return dto.areas
    .map(mapSingleArea)
    .filter(
      (row) =>
        row.photoUrls.length > 0 ||
        Boolean(row.comments) ||
        (row.condition && row.condition !== 'Unrated'),
    );
}

/** Flatten the findings tree into labeled proof photos for the history report. */
export function mapInspectionDetailPhotos(
  dto: InspectorInspectionDetail,
): LabeledPhoto[] {
  const photos: LabeledPhoto[] = [];
  for (const area of dto.areas) {
    const areaName = asString(area.name) ?? 'Unnamed area';
    for (const [index, photo] of area.photos.entries()) {
      photos.push({ label: `${areaName} · ${index + 1}`, url: photo.url });
    }
    for (const item of area.items) {
      const itemName = asString(item.name) ?? 'Item';
      for (const [index, photo] of item.photos.entries()) {
        photos.push({
          label: `${areaName} · ${itemName} · ${index + 1}`,
          url: photo.url,
        });
      }
    }
  }
  for (const [index, photo] of dto.photos.entries()) {
    photos.push({ label: `Inspection · ${index + 1}`, url: photo.url });
  }
  return photos;
}

// -------------------------------- Tribunal -------------------------------

/**
 * Map one assigned tribunal case (the inspector's hearing brief) onto the FE
 * TribunalHearing view-model. The server derives what it faithfully can — evidence
 * completeness (staff pre-hearing review), hearing scheduled, attendance billed —
 * and the FE-only checklist keys (documentsDownloaded) start unchecked. Package
 * documents render from the present evidence titles (no file URLs exist server-side
 * yet, matching the seed's placeholder links).
 */
export function toTribunalHearing(dto: InspectorTribunalCaseDto): TribunalHearing {
  const outcomeResult = asString(dto.outcomeResult);
  const outcome = (TRIBUNAL_OUTCOMES as readonly string[]).includes(
    outcomeResult ?? '',
  )
    ? (outcomeResult as TribunalOutcome)
    : undefined;
  return {
    id: dto.id,
    hearingDate: asString(dto.hearingDate)?.slice(0, 10) ?? '',
    hearingTime: asString(dto.hearingTime) ?? '',
    tribunalType: TRIBUNAL_TYPE_LABEL[dto.tribunalType] ?? dto.tribunalType,
    location:
      asString(dto.hearingLocation) ??
      asString(dto.tribunalBody) ??
      'To be advised',
    propertyAddress: dto.propertyAddress,
    caseSummary: dto.caseSummary,
    rentalArrears: asNumber(dto.outstandingRent) ?? undefined,
    bondClaimAmount: asNumber(dto.bondAmount) ?? undefined,
    checklist: {
      evidenceComplete: dto.evidenceComplete,
      hearingConfirmed: asString(dto.hearingDate) !== null,
      documentsDownloaded: false,
      attendanceConfirmed: dto.attendanceRecorded,
    },
    packageDocuments: dto.evidence
      .filter((e) => e.present)
      .map((e) => ({ name: e.title, url: '#' })),
    outcome,
    status: dto.closed ? 'completed' : 'upcoming',
  };
}

export function mapTribunalCases(
  dtos: InspectorTribunalCaseDto[],
): TribunalHearing[] {
  return dtos.map(toTribunalHearing);
}

// ------------------------- Profile & registration ------------------------

/**
 * Merge the server's registration record (status truth: pending/approved/rejected,
 * review timestamps) over the locally saved form. Date of birth, address, and
 * bank details are not stored on this device. The account row shows the last 4
 * digits the server returns.
 */
export function mapInspectorRegistration(
  dto: InspectorRegistrationStatusDto,
  local: InspectorRegistration | null,
): InspectorRegistration {
  const toDateInput = (value: unknown): string =>
    asString(value)?.slice(0, 10) ?? '';
  return {
    firstName: dto.firstName,
    lastName: dto.lastName,
    email: dto.email,
    mobile: asString(dto.mobile) ?? local?.mobile ?? '',
    dateOfBirth: local?.dateOfBirth ?? '',
    residentialAddress: local?.residentialAddress ?? '',
    abn: asString(dto.abn) ?? local?.abn,
    licenceNumber: asString(dto.licenceNumber) ?? local?.licenceNumber,
    licenceType: asString(dto.licenceType) ?? local?.licenceType ?? '',
    licenceExpiry: toDateInput(dto.licenceExpiry) || local?.licenceExpiry,
    serviceRegions: dto.serviceRegions,
    tribunalQualified: dto.tribunalQualified,
    bankAccountName: local?.bankAccountName ?? '',
    bankBsb: local?.bankBsb ?? '',
    bankAccountNumber:
      local?.bankAccountNumber?.trim() || asString(dto.bankAccountLast4) || '',
    registrationStatus:
      dto.registrationStatus as InspectorRegistration['registrationStatus'],
    submittedAt: asString(dto.submittedAt) ?? undefined,
    reviewedAt: asString(dto.reviewedAt) ?? undefined,
  };
}

// ------------------------------- Messages --------------------------------

/** Map one API thread message onto the FE ThreadMessage (carrying the server `fromSelf`). */
function toThreadMessage(
  m: InspectorMessageThread['messages'][number],
): ThreadMessage {
  return {
    id: m.id,
    from: m.from,
    body: m.body,
    at: m.at,
    fromSelf: m.fromSelf,
    // `fileName` and `url` are optional on the contract, so an attachment can arrive with
    // neither. Dropping those rather than rendering a nameless link to nowhere: a chip
    // labelled "undefined" that 404s is worse than an attachment the message does not
    // mention. Defaults cover the name-only and url-only cases.
    attachments: (m.attachments ?? [])
      .filter((a) => a.fileName || a.url)
      .map((a) => ({
        name: a.fileName ?? 'Attachment',
        url: a.url ?? '',
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
      })),
  };
}

/** Map one API message thread onto the FE MessageThread card (no nested messages). */
export function toMessageThread(dto: InspectorMessageThread): MessageThread {
  return {
    id: dto.id,
    subject: dto.subject,
    participants: dto.participants,
    lastMessage: asString(dto.lastMessage) ?? '',
    lastAt: asString(dto.lastAt) ?? '',
    unread: asNumber(dto.unread) ?? 0,
    // A thread tagged to an inspection is an inspection conversation; a general enquiry
    // (no inspectionId) is grouped with the staff/agent bucket.
    category: asString(dto.inspectionId) ? 'inspection' : 'agent',
    inspectionId: dto.inspectionId,
    inspectionTrackingNumber: dto.inspectionTrackingNumber,
    propertyAddress: dto.propertyAddress,
  };
}

/**
 * Split the API threads (each carrying its messages nested) into the two shapes the FE
 * holds separately: the thread cards (`MessageThread[]`) and the per-thread message map
 * (`Record<threadId, ThreadMessage[]>`) the detail screen reads.
 */
export function mapInspectorMessages(dtos: InspectorMessageThread[]): {
  threads: MessageThread[];
  messagesByThread: Record<string, ThreadMessage[]>;
} {
  const threads = dtos.map(toMessageThread);
  const messagesByThread: Record<string, ThreadMessage[]> = {};
  for (const dto of dtos) {
    messagesByThread[dto.id] = dto.messages.map(toThreadMessage);
  }
  return { threads, messagesByThread };
}

// ----------------------------- Notifications -----------------------------

/** API InspectorNotificationType (UPPER) -> the FE's lowercase notification union. */
const NOTIFICATION_TYPE_VIEW: Record<
  InspectorNotificationDto['type'],
  InspectorNotification['type']
> = {
  [INSPECTOR_NOTIFICATION_TYPE.JOB_ASSIGNED]: 'job_assigned',
  [INSPECTOR_NOTIFICATION_TYPE.JOB_AVAILABLE]: 'job_available',
  [INSPECTOR_NOTIFICATION_TYPE.TRIBUNAL]: 'tribunal',
  [INSPECTOR_NOTIFICATION_TYPE.MESSAGE]: 'message',
  [INSPECTOR_NOTIFICATION_TYPE.SYNC_COMPLETE]: 'sync_complete',
};

/** Map one API notification onto the FE InspectorNotification view-model. */
export function toInspectorNotification(
  dto: InspectorNotificationDto,
): InspectorNotification {
  return {
    id: dto.id,
    type: NOTIFICATION_TYPE_VIEW[dto.type] ?? 'message',
    title: dto.title ? dto.title.charAt(0).toUpperCase() + dto.title.slice(1) : dto.title,
    body: dto.body ? dto.body.charAt(0).toUpperCase() + dto.body.slice(1) : dto.body,
    href: dto.href,
    read: dto.read,
    createdAt: asString(dto.at) ?? '',
  };
}

export function mapInspectorNotifications(
  dtos: InspectorNotificationDto[],
): InspectorNotification[] {
  return dtos.map(toInspectorNotification);
}
