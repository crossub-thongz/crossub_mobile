import type { CoreInspectionType } from '@/src/constants/inspection';
import type { InspectionType } from '@/src/lib/types';

const START_COPY: Record<
  CoreInspectionType,
  { startLabel: string; continueLabel: string; body: string }
> = {
  ingoing: {
    startLabel: 'Start ingoing',
    continueLabel: 'Continue ingoing',
    body: 'Arrange the rooms first — add, rename, reorder, or remove. Then start the condition report and walk room by room.',
  },
  outgoing: {
    startLabel: 'Start outgoing',
    continueLabel: 'Continue outgoing',
    body: 'Arrange rooms first. Move-in photos copy across so you only record what changed once you start.',
  },
  routine: {
    startLabel: 'Start routine',
    continueLabel: 'Continue routine',
    body: 'Arrange rooms first. After you start, photograph each room overall — skip any area that is in order.',
  },
  open: {
    startLabel: 'Start inspection',
    continueLabel: 'Continue inspection',
    body: 'Open the viewing when you arrive on site.',
  },
};

export function inspectionStartCopy(kind: CoreInspectionType) {
  return START_COPY[kind];
}

export function jobStartCta(type: InspectionType, started: boolean): string {
  if (type === 'ingoing' || type === 'outgoing' || type === 'routine' || type === 'open') {
    const copy = START_COPY[type];
    return started ? copy.continueLabel : copy.startLabel;
  }
  return started ? 'Continue inspection' : 'Start inspection';
}

export function layoutSourceLabel(
  source: 'template' | 'copied' | 'manual',
  roomCount: number,
): string | null {
  if (roomCount === 0) return null;
  if (source === 'copied') {
    return `${roomCount} area${roomCount === 1 ? '' : 's'} copied from the last ingoing report`;
  }
  if (source === 'template') {
    return `${roomCount} area${roomCount === 1 ? '' : 's'} loaded from the property layout`;
  }
  return null;
}

export function preInspectionSmsHref(job: {
  tenantPhone?: string;
  tenantName?: string;
  propertyAddress: string;
  scheduledTime: string;
  scheduledDate: string;
}): string | null {
  if (!job.tenantPhone?.trim()) return null;
  const name = job.tenantName?.trim() || 'there';
  const when = job.scheduledTime || job.scheduledDate;
  const body = `Hi ${name}, reminder that your routine inspection at ${job.propertyAddress} is scheduled for ${when}. Please ensure access. — Crossub Inspections`;
  return `sms:${job.tenantPhone.replace(/[^\d+]/g, '')}?body=${encodeURIComponent(body)}`;
}
