import type { InspectionType } from '@/src/lib/types';

export const INSPECTOR_HOURLY_RATE_AUD = 45;
export const ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD = 45;
export const INGOING_OUTGOING_FEE_AUD = 90;

export const INSPECTION_PAY_LABEL: Record<InspectionType, string> = {
  open: 'Open',
  ingoing: 'Entry',
  outgoing: 'Final',
  routine: 'Routine',
  tribunal: 'Tribunal',
};

export const CORE_INSPECTION_TYPES = [
  'open',
  'ingoing',
  'outgoing',
  'routine',
] as const;

export type CoreInspectionType = (typeof CORE_INSPECTION_TYPES)[number];

export const INSPECTION_TYPE_LABEL: Record<CoreInspectionType, string> = {
  open: 'OPEN',
  ingoing: 'ENTRY',
  outgoing: 'FINAL',
  routine: 'ROUTINE',
};

export function isCoreInspectionType(type: InspectionType): type is CoreInspectionType {
  return (CORE_INSPECTION_TYPES as readonly string[]).includes(type);
}

export const INSPECTION_APPROVAL_GO_LIVE = '2026-08-13T14:00:00.000Z';

export function inspectionAwaitingOfficerApproval(job: {
  completedAt?: string | null;
  approvedAt?: string | null;
}): boolean {
  if (job.approvedAt) return false;
  if (!job.completedAt) return false;
  const completed = new Date(job.completedAt).getTime();
  if (Number.isNaN(completed)) return false;
  return completed >= new Date(INSPECTION_APPROVAL_GO_LIVE).getTime();
}

export const ONE_BED_AREAS = [
  'Lounge Room',
  'Dining Room',
  'Kitchen',
  'Laundry',
  'Bathroom',
  'Bedroom 1',
] as const;
