import type { InspectorOpenViewingVisitor } from '@/src/api/inspector';

export function isInterestedApplicant(visitor: InspectorOpenViewingVisitor): boolean {
  return Boolean(visitor.hasApplication);
}

export function isOpenInspectionCheckIn(visitor: InspectorOpenViewingVisitor): boolean {
  const attendance = (visitor.attendanceStatus ?? '').toLowerCase();
  if (attendance === 'attended' || attendance === 'no_show') return true;
  if (visitor.registrationSource === 'walk_in') return true;
  return !isInterestedApplicant(visitor);
}

export function splitOpenInspectionVisitors(visitors: InspectorOpenViewingVisitor[]): {
  checkIns: InspectorOpenViewingVisitor[];
  interested: InspectorOpenViewingVisitor[];
} {
  return {
    checkIns: visitors.filter(isOpenInspectionCheckIn),
    interested: visitors.filter(isInterestedApplicant),
  };
}

export function openInspectionQrImageUrl(url: string, size = 256): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;
}

export function formatOpenInspectionClock(endIso: string, nowMs: number): string {
  const end = new Date(endIso).getTime();
  if (Number.isNaN(end)) return '—';
  const diff = Math.max(0, end - nowMs);
  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function openInspectionRemainingRatio(
  startIso: string,
  endIso: string,
  nowMs: number,
): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(1, Math.max(0, (end - nowMs) / (end - start)));
}
