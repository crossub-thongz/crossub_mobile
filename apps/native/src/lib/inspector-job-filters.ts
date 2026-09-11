import { isToday, startOfLocalDay } from '@/src/lib/datetime';
import type { InspectionJob } from '@/src/lib/types';

function jobScheduleIso(job: InspectionJob): string {
  return job.scheduledTime || job.scheduledDate;
}

function isActiveInspectJob(job: InspectionJob): boolean {
  return (
    job.status !== 'completed' &&
    job.status !== 'declined' &&
    !isPoolJob(job)
  );
}

export function isPoolJob(job: InspectionJob): boolean {
  if (job.assignedBy === 'CROSSUB') return false;
  if (job.type === 'routine' && job.source !== 'pool') return false;
  if (job.status === 'available') return true;
  if (job.source === 'assigned' && job.status === 'assigned') {
    return job.type === 'open' || job.type === 'ingoing' || job.type === 'outgoing';
  }
  return false;
}

export function isTodaysInspection(job: InspectionJob): boolean {
  return isActiveInspectJob(job) && isToday(jobScheduleIso(job));
}

export function isUpcomingInspection(job: InspectionJob): boolean {
  if (!isActiveInspectJob(job)) return false;
  const scheduled = new Date(jobScheduleIso(job));
  if (Number.isNaN(scheduled.getTime())) return false;
  const day = new Date(scheduled);
  day.setHours(0, 0, 0, 0);
  return day.getTime() > startOfLocalDay().getTime();
}

export function isOverdueInspection(job: InspectionJob): boolean {
  if (!isActiveInspectJob(job) || job.status === 'awaiting_approval') return false;
  const scheduled = new Date(jobScheduleIso(job));
  if (Number.isNaN(scheduled.getTime())) return false;
  return scheduled < startOfLocalDay();
}

export function byScheduleTime(a: InspectionJob, b: InspectionJob): number {
  return (
    new Date(a.scheduledTime || a.scheduledDate).getTime() -
    new Date(b.scheduledTime || b.scheduledDate).getTime()
  );
}
