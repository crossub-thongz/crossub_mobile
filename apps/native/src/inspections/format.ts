import type { InspectorInspection } from '@/src/api/inspector';

const sydneyDate = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney',
  day: 'numeric',
  month: 'short',
});

export function inspectionAddress(item: InspectorInspection): string {
  const street = item.propertyAddress?.trim();
  const suburb = item.propertySuburb?.trim();
  if (street && suburb) return `${street}, ${suburb}`;
  return street || suburb || 'Address unavailable';
}

export function inspectionWhen(item: InspectorInspection): string {
  const iso = item.scheduledDate ?? item.inspectionDate ?? item.createdAt;
  if (!iso) return 'No date';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No date';
  return sydneyDate.format(date);
}

export function inspectionTypeLabel(type: InspectorInspection['type']): string {
  switch (type) {
    case 'INGOING':
      return 'Entry';
    case 'OUTGOING':
      return 'Final';
    case 'ROUTINE':
      return 'Routine';
    case 'OPEN':
      return 'Open';
    case 'CONDITION':
      return 'Condition';
    case 'WARD_ROUND':
      return 'Ward round';
    default:
      return type;
  }
}
