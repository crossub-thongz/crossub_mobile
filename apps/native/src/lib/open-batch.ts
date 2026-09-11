import { OPEN_BATCH_TIMEZONE } from '@/src/constants/open-batch';
import type { OpenBatchPlan, OpenBatchPlannedStop } from '@/src/api/inspector';

function lowerMeridiem(value: string): string {
  return value.replace(/\b(am|pm)\b/gi, (m) => m.toLowerCase());
}

export function formatOpenTime(iso: string): string {
  return lowerMeridiem(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: OPEN_BATCH_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso)),
  );
}

export function formatOpenDate(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: OPEN_BATCH_TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

export function formatOpenDeadline(iso: string): string {
  return lowerMeridiem(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: OPEN_BATCH_TIMEZONE,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso)),
  );
}

export function toSydneyInputValue(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: OPEN_BATCH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '00';
  const hour = pick('hour') === '24' ? '00' : pick('hour');
  return `${pick('year')}-${pick('month')}-${pick('day')}T${hour}:${pick('minute')}`;
}

export function fromSydneyInputValue(value: string): string | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const asIfUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  if (Number.isNaN(asIfUtc)) return null;

  const offsetAt = (instant: number): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: OPEN_BATCH_TIMEZONE,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(instant));
    const num = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? '0');
    return (
      Date.UTC(
        num('year'),
        num('month') - 1,
        num('day'),
        num('hour') % 24,
        num('minute'),
        num('second'),
      ) - instant
    );
  };

  const corrected = offsetAt(asIfUtc - offsetAt(asIfUtc));
  return new Date(asIfUtc - corrected).toISOString();
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} m`;
}

export function formatPlanWindow(plan: OpenBatchPlan): string | null {
  if (plan.stops.length === 0) return null;
  const first = plan.stops[0];
  const last = plan.stops[plan.stops.length - 1];
  return `${formatOpenTime(first.startTime)} – ${formatOpenTime(last.endTime)}`;
}

export function stopsMissingAgentPreference(plan: OpenBatchPlan): OpenBatchPlannedStop[] {
  return plan.stops.filter((stop) => stop.agentPreferenceHonoured === false);
}
