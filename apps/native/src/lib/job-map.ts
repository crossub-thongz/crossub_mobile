import {
  INGOING_OUTGOING_FEE_AUD,
  ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD,
  inspectionAwaitingOfficerApproval,
} from '@/src/constants/inspection';
import { INSPECTION_STATUS, INSPECTION_TYPE } from '@/src/constants/inspections';
import type { InspectorInspection } from '@/src/api/inspector';
import type {
  InspectionJob,
  InspectionType,
  JobStatus,
  PropertyInspectionSpec,
} from '@/src/lib/types';

const TYPE_VIEW: Record<InspectorInspection['type'], InspectionType> = {
  [INSPECTION_TYPE.OPEN]: 'open',
  [INSPECTION_TYPE.INGOING]: 'ingoing',
  [INSPECTION_TYPE.OUTGOING]: 'outgoing',
  [INSPECTION_TYPE.ROUTINE]: 'routine',
  [INSPECTION_TYPE.CONDITION]: 'routine',
  [INSPECTION_TYPE.WARD_ROUND]: 'routine',
};

const STATUS_VIEW: Record<InspectorInspection['status'], JobStatus> = {
  [INSPECTION_STATUS.DRAFT]: 'assigned',
  [INSPECTION_STATUS.IN_PROGRESS]: 'in_progress',
  [INSPECTION_STATUS.FIRST_REVIEW]: 'completed',
  [INSPECTION_STATUS.SECOND_REVIEW]: 'completed',
  [INSPECTION_STATUS.COMPLETED]: 'completed',
  [INSPECTION_STATUS.PUBLISHED]: 'completed',
  [INSPECTION_STATUS.CANCELLED]: 'declined',
};

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function propertySpecFromDto(dto: InspectorInspection): PropertyInspectionSpec {
  const bedrooms = asNumber(dto.propertyBedrooms) ?? 1;
  const bathrooms = asNumber(dto.propertyBathrooms) ?? 1;
  const type = asString(dto.propertyType)?.toUpperCase();
  if (type === 'HOUSE' || type === 'TOWNHOUSE') {
    return { propertyKind: 'house', bedrooms, bathrooms };
  }
  return { propertyKind: 'apartment', bedrooms, bathrooms };
}

function mapStatus(dto: InspectorInspection, type: InspectionType): JobStatus {
  const pendingReview =
    (type === 'ingoing' || type === 'outgoing') &&
    !dto.approvedAt &&
    !dto.reportDeclineReason &&
    (dto.status === INSPECTION_STATUS.COMPLETED ||
      dto.status === INSPECTION_STATUS.FIRST_REVIEW ||
      dto.status === INSPECTION_STATUS.SECOND_REVIEW) &&
    inspectionAwaitingOfficerApproval({
      completedAt: dto.completedDate ?? dto.inspectionDate,
      approvedAt: dto.approvedAt,
    });
  if (pendingReview) return 'awaiting_approval';
  return STATUS_VIEW[dto.status] ?? 'assigned';
}

function payFor(type: InspectionType): { hours: number; amount: number } {
  if (type === 'routine' || type === 'open') {
    return { hours: 1, amount: ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD };
  }
  if (type === 'ingoing' || type === 'outgoing') {
    return { hours: 2, amount: INGOING_OUTGOING_FEE_AUD };
  }
  return { hours: 2, amount: 90 };
}

export function toInspectionJob(dto: InspectorInspection): InspectionJob {
  const type = TYPE_VIEW[dto.type] ?? 'routine';
  const scheduled =
    asString(dto.scheduledDate) ??
    asString(dto.inspectionDate) ??
    asString(dto.createdAt) ??
    '';
  const property = propertySpecFromDto(dto);
  const pay = payFor(type);
  const lat = asNumber(dto.propertyLatitude);
  const lng = asNumber(dto.propertyLongitude);
  return {
    id: dto.id,
    type,
    propertyAddress: asString(dto.propertyAddress) ?? 'Assigned property',
    suburb: asString(dto.propertySuburb) ?? '',
    ...(lat != null && lng != null ? { latitude: lat, longitude: lng } : {}),
    scheduledDate: scheduled,
    scheduledTime: scheduled,
    createdAt: asString(dto.createdAt) ?? undefined,
    priority: dto.urgent ? 'urgent' : 'normal',
    status: mapStatus(dto, type),
    source: 'assigned',
    ...(dto.assignedByStaff ? { assignedBy: 'CROSSUB' } : {}),
    tenantName: asString(dto.tenantName) ?? undefined,
    tenantPhone: asString(dto.tenantPhone) ?? undefined,
    tenantEmail: asString(dto.tenantEmail) ?? undefined,
    agentName: asString(dto.agentName) ?? undefined,
    agentCompany: asString(dto.agentCompany) ?? undefined,
    agentEmail: asString(dto.agentEmail) ?? undefined,
    agentPhone: asString(dto.agentPhone) ?? undefined,
    propertyImageUrl: asString(dto.propertyImageUrl) ?? undefined,
    leaseStart: asString(dto.leaseStart) ?? undefined,
    leaseEnd: asString(dto.leaseEnd) ?? undefined,
    property,
    durationLabel: `Approx. ${pay.hours} hr${pay.hours === 1 ? '' : 's'}`,
    estimatedHours: pay.hours,
    laborAmount: pay.amount,
    payAmount: pay.amount,
    reportDeclineReason: asString(dto.reportDeclineReason) ?? undefined,
    approvedAt: asString(dto.approvedAt) ?? undefined,
    reportUrl: asString(dto.reportUrl) ?? undefined,
    ...(dto.awaitingAgentPayment ? { awaitingAgentPayment: true } : {}),
  };
}

export function toPoolInspectionJob(dto: InspectorInspection): InspectionJob {
  return { ...toInspectionJob(dto), status: 'available', source: 'pool' };
}

export function mapAssignedJobs(dtos: InspectorInspection[]): InspectionJob[] {
  return dtos.map(toInspectionJob);
}

export function mapPoolJobs(dtos: InspectorInspection[]): InspectionJob[] {
  return dtos.filter((dto) => !dto.assignedByStaff).map(toPoolInspectionJob);
}
