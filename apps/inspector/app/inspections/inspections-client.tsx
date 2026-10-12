'use client';

import { ClipboardCheck } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { EmptyState } from '@/components/inspector/empty-state';
import { InspectJobRow } from '@/components/inspector/inspect-job-row';
import { InspectNextCard } from '@/components/inspector/inspect-next-card';
import { InspectorShell } from '@/components/layout/inspector-shell';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { useDeviceLocation } from '@/lib/use-device-position';
import {
  CORE_INSPECTION_TYPES,
  type CoreInspectionType,
} from '@/constants/inspection';
import {
  isOverdueInspection,
  isTodaysInspection,
  isUpcomingInspection,
} from '@/lib/inspector-job-filters';
import type { InspectionJob } from '@/lib/types';
import { cn } from '@/lib/utils';

type ScheduleTab = 'today' | 'upcoming' | 'overdue' | 'completed';

function parseTab(value: string | null): ScheduleTab {
  if (
    value === 'upcoming' ||
    value === 'overdue' ||
    value === 'completed' ||
    value === 'today'
  ) {
    return value;
  }
  return 'today';
}

function isAssignedInspection(job: InspectionJob): boolean {
  return (
    job.status !== 'available' &&
    job.status !== 'declined' &&
    CORE_INSPECTION_TYPES.includes(job.type as CoreInspectionType)
  );
}

function byScheduleTime(a: InspectionJob, b: InspectionJob): number {
  return (
    new Date(a.scheduledTime || a.scheduledDate).getTime() -
    new Date(b.scheduledTime || b.scheduledDate).getTime()
  );
}

export default function InspectionsPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = parseTab(searchParams.get('tab') ?? searchParams.get('when'));
  const { jobs, completedJobs } = useInspectorData();
  const deviceLocation = useDeviceLocation();

  const setTab = (next: ScheduleTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'today') params.delete('tab');
    else params.set('tab', next);
    params.delete('when');
    params.delete('type');
    params.delete('section');
    router.replace(
      params.toString() ? `/inspections?${params.toString()}` : '/inspections',
      { scroll: false },
    );
  };

  useEffect(() => {
    const legacyType = searchParams.get('type');
    const legacySection = searchParams.get('section');
    const legacyWhen = searchParams.get('when');
    if (!legacyType && !legacySection && !legacyWhen) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('type');
    params.delete('section');
    params.delete('when');
    const nextTab = parseTab(legacyWhen ?? params.get('tab'));
    if (nextTab === 'today') params.delete('tab');
    else params.set('tab', nextTab);
    router.replace(
      params.toString() ? `/inspections?${params.toString()}` : '/inspections',
      { scroll: false },
    );
  }, [router, searchParams]);

  const pendingJobs = useMemo(
    () => jobs.filter((j) => isAssignedInspection(j) && j.status !== 'completed'),
    [jobs],
  );

  const todayJobs = useMemo(
    () => pendingJobs.filter(isTodaysInspection).sort(byScheduleTime),
    [pendingJobs],
  );

  const upcomingJobs = useMemo(
    () => pendingJobs.filter(isUpcomingInspection).sort(byScheduleTime),
    [pendingJobs],
  );

  const overdueJobs = useMemo(
    () => pendingJobs.filter(isOverdueInspection).sort(byScheduleTime),
    [pendingJobs],
  );

  const doneJobs = useMemo(
    () =>
      completedJobs
        .filter(isAssignedInspection)
        .sort(
          (a, b) =>
            new Date(b.scheduledTime || b.scheduledDate).getTime() -
            new Date(a.scheduledTime || a.scheduledDate).getTime(),
        ),
    [completedJobs],
  );

  const nextJob = useMemo(() => {
    const now = Date.now();
    const remaining = todayJobs.filter(
      (job) => new Date(job.scheduledTime || job.scheduledDate).getTime() >= now,
    );
    return remaining[0] ?? todayJobs[0] ?? null;
  }, [todayJobs]);

  const listJobs =
    tab === 'today'
      ? todayJobs
      : tab === 'upcoming'
        ? upcomingJobs
        : tab === 'overdue'
          ? overdueJobs
          : doneJobs;
  const listWithoutHero =
    tab === 'today' && nextJob
      ? listJobs.filter((job) => job.id !== nextJob.id)
      : listJobs;

  const emptyTitle =
    tab === 'today'
      ? 'No inspections today'
      : tab === 'upcoming'
        ? 'No upcoming inspections'
        : tab === 'overdue'
          ? 'No overdue inspections'
          : 'No completed inspections';
  const emptyDescription =
    tab === 'today'
      ? 'Accepted jobs scheduled for today will show here.'
      : tab === 'upcoming'
        ? 'Jobs scheduled after today will show here.'
        : tab === 'overdue'
          ? 'Jobs that were not finished after their scheduled date will show here.'
          : 'Finished inspections will show here.';

  return (
    <InspectorShell title="My Inspections" variant="workspace">
      <div className="flex min-h-full flex-col">
        <div className="flex gap-1">
          {(
            [
              { id: 'today' as const, label: 'Today', count: todayJobs.length },
              {
                id: 'upcoming' as const,
                label: 'Upcoming',
                count: upcomingJobs.length,
              },
              {
                id: 'overdue' as const,
                label: 'Overdue',
                count: overdueJobs.length,
              },
            ] as const
          ).map(({ id, label, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-semibold transition',
                tab === id
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent',
              )}
            >
              {label}
              <span
                className={cn(
                  'rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums',
                  tab === id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3 pt-3 pb-28">
          {tab === 'today' && nextJob ? (
            <InspectNextCard job={nextJob} origin={deviceLocation} />
          ) : null}

          {listJobs.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title={emptyTitle}
              description={emptyDescription}
            />
          ) : (
            <>
              {tab !== 'completed' ? (
                <p className="text-muted-foreground px-0.5 text-[11px] font-semibold tracking-wide uppercase">
                  {tab === 'today'
                    ? `Today • ${todayJobs.length} inspection${todayJobs.length === 1 ? '' : 's'}`
                    : tab === 'upcoming'
                      ? `Upcoming • ${upcomingJobs.length} inspection${upcomingJobs.length === 1 ? '' : 's'}`
                      : `Overdue • ${overdueJobs.length} inspection${overdueJobs.length === 1 ? '' : 's'}`}
                </p>
              ) : null}
              {(tab === 'today' ? listWithoutHero : listJobs).map((job) => (
                <InspectJobRow
                  key={job.id}
                  job={job}
                  completed={tab === 'completed'}
                  origin={deviceLocation}
                />
              ))}
            </>
          )}
        </div>

        <div className="fixed bottom-16 left-1/2 z-40 flex w-[min(100%-2rem,28rem)] -translate-x-1/2 rounded-full bg-secondary p-1">
          <button
            type="button"
            onClick={() => {
              if (tab === 'completed') setTab('today');
            }}
            className={cn(
              'flex-1 rounded-full py-2 text-xs font-semibold transition',
              tab !== 'completed'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground',
            )}
          >
            Active ({pendingJobs.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('completed')}
            className={cn(
              'flex-1 rounded-full py-2 text-xs font-semibold transition',
              tab === 'completed'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground',
            )}
          >
            Completed ({doneJobs.length})
          </button>
        </div>
      </div>
    </InspectorShell>
  );
}
