import type { InspectionType } from '@/lib/types';

export const INSPECTOR_PAY_CURRENCY = 'AUD' as const;

export {
  FUEL_RATE_PER_KM_AUD,
  INSPECTOR_HOURLY_RATE_AUD,
  ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD,
  REGIONAL_MIDPOINTS,
  APARTMENT_INSPECTION_HOURS,
  HOUSE_AREA_MINUTES,
  TRIBUNAL_INSPECTION_HOURS,
} from '@/constants/inspection-rates';
export type { ServiceRegionKey } from '@/constants/inspection-rates';

/** @deprecated Use property-based duration from inspection-rates guidelines */
export const ESTIMATED_HOURS_BY_TYPE: Record<InspectionType, number> = {
  open: 1.5,
  ingoing: 2,
  outgoing: 2.5,
  routine: 1,
  tribunal: 2,
};

export const INSPECTION_PAY_LABEL: Record<InspectionType, string> = {
  open: 'Open',
  ingoing: 'Entry',
  outgoing: 'Final',
  routine: 'Routine',
  tribunal: 'Tribunal',
};

/** Core field inspection types (excludes tribunal — separate module). */
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

/**
 * Heading label for any inspection type — the core four by their own name, anything
 * else (a demo tribunal row, a type added to the contract later) by its key rather
 * than being silently dropped from a grouped list. CRS-0103.
 */
export function inspectionTypeHeading(type: InspectionType): string {
  return INSPECTION_TYPE_LABEL[type as CoreInspectionType] ?? type.toUpperCase();
}

export const INSPECTION_TYPE_DESCRIPTION: Record<CoreInspectionType, string> = {
  open: 'Property readiness, QR registration, and open reports',
  ingoing: 'Room-by-room condition at lease start',
  outgoing: 'Bond claims, damage comparison, end of lease',
  routine: 'Physical or tenant self-inspection during tenancy',
};

/** @deprecated Prefer INSPECTION_AREAS from inspection-areas — kept for call sites. */
export {
  INSPECTION_AREAS as INGOING_AREAS,
  INSPECTION_AREA_CATALOG,
  COMMON_DEFAULT_SECTIONS,
  getInspectionAreaDefinition,
  sectionAreaName,
} from '@/constants/inspection-areas';

export const OPEN_READINESS_PHOTOS = [
  'Front Entrance',
  'Living Room',
  'Kitchen',
  'Bathroom',
  'Bedroom',
  'Outdoor Area',
] as const;

export const OPEN_FINISH_CHECKS = [
  'Doors Locked',
  'Windows Closed',
  'Lights Off',
  'Keys Collected',
] as const;

export const ROUTINE_AREAS = [
  'Property Condition',
  'Maintenance Issues',
  'Lease Breaches',
  'Pets',
  'Cleanliness',
  'Safety Issues',
] as const;

export const TRIBUNAL_OUTCOMES = [
  'claim_successful',
  'partially_successful',
  'rejected',
  'adjourned',
] as const;
