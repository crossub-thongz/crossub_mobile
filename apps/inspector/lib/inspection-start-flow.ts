import type { InspectionAreaKind } from '@/lib/inspection-area-workflow';
import type { InspectionJob, InspectionType } from '@/lib/types';

export type InspectionLayoutSource = 'template' | 'copied' | 'manual';

const START_COPY: Record<
  InspectionAreaKind,
  {
    title: string;
    body: string;
    startLabel: string;
    continueLabel: string;
    sectionsHint: string;
    firstRoomHint: string;
  }
> = {
  ingoing: {
    title: 'Start Entry',
    body: 'Arrange the rooms first — add, rename, reorder, or remove. Then start the condition report and walk room by room.',
    startLabel: 'Start Entry',
    continueLabel: 'Continue Entry',
    sectionsHint: 'Photograph clockwise from the door. Extra close-ups for damage and safety.',
    firstRoomHint:
      'Start at the door and photograph clockwise around the room. Add close-ups of damage and safety items such as blind cords.',
  },
  outgoing: {
    title: 'Start Final',
    body: 'Arrange rooms first. Photograph each item as it is now for the Final report.',
    startLabel: 'Start Final',
    continueLabel: 'Continue Final',
    sectionsHint: 'Photograph the room as it is now. Extra close-ups for damage and make-good items.',
    firstRoomHint:
      'Photograph Final changes, damage, and make-good items. Do not retake Entry photos on this job.',
  },
  routine: {
    title: 'Start routine',
    body: 'Arrange rooms first. After you start, photograph each room overall — skip any area that is in order.',
    startLabel: 'Start routine',
    continueLabel: 'Continue routine',
    sectionsHint: 'Exception-based: skip rooms that are fine, photograph issues only.',
    firstRoomHint:
      'Photograph the room as it is now. Add notes if anything needs attention.',
  },
};

export function inspectionStartCopy(kind: InspectionAreaKind) {
  return START_COPY[kind];
}

export function setupStartLabel(
  kind: InspectionAreaKind,
  continuing: boolean,
): string {
  const copy = START_COPY[kind];
  return continuing ? copy.continueLabel : copy.startLabel;
}

export function jobStartCta(
  type: InspectionType,
  started: boolean,
): string {
  if (type === 'ingoing' || type === 'outgoing' || type === 'routine') {
    return setupStartLabel(type, started);
  }
  return started ? 'Continue inspection' : 'Start inspection';
}

export function layoutSourceLabel(
  source: InspectionLayoutSource,
  roomCount: number,
): string | null {
  if (roomCount === 0) return null;
  if (source === 'copied') {
    return `${roomCount} area${roomCount === 1 ? '' : 's'} copied from the last Entry report`;
  }
  if (source === 'template') {
    return `${roomCount} area${roomCount === 1 ? '' : 's'} loaded from the property layout`;
  }
  return null;
}

function smsDigits(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

export function preInspectionSmsHref(job: InspectionJob): string | null {
  if (!job.tenantPhone?.trim()) return null;
  const name = job.tenantName?.trim() || 'there';
  const when = job.scheduledTime || job.scheduledDate;
  const body = `Hi ${name}, reminder that your routine inspection at ${job.propertyAddress} is scheduled for ${when}. Please ensure access. — Crossub Inspections`;
  return `sms:${smsDigits(job.tenantPhone)}?body=${encodeURIComponent(body)}`;
}
