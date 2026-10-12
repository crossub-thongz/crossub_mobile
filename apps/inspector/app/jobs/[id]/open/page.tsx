'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, Loader2, Radio, Star, Users } from 'lucide-react';
import { toast } from 'sonner';

import { JobWorkspaceShell } from '@/components/inspector/job-workspace-shell';
import { OpenInspectionCountdown } from '@/components/open-inspection/open-inspection-countdown';
import { OpenInspectionReferenceTabs } from '@/components/open-inspection/open-inspection-reference-tabs';
import { JobLookupFallback } from '@/components/inspector/job-lookup-fallback';
import { KeyCollectionRequired } from '@/components/inspector/key-collection-required';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { Button } from '@/components/ui/button';
import { jobInspect, jobKeys, ROUTES } from '@/constants/routes';
import { useFinishInspection } from '@/hooks/use-finish-inspection';
import {
  useAwaitingAgentPaymentGate,
  useInspectionFinishedGate,
  useInspectionInProgress,
  useKeyCollectGate,
} from '@/hooks/use-key-collect-gate';
import {
  fetchOpenViewing,
  splitOpenInspectionVisitors,
  startOpenViewing,
  type InspectorOpenViewing,
} from '@/lib/inspector-open-viewing';
import {
  formatOpenInspectionClock,
  formatOpenInspectionEarlyTimingNotice,
  openInspectionRemainingRatio,
} from '@/lib/open-inspection-ui';
import { cn, formatTime } from '@/lib/utils';
import {
  isInspectionWorkflowFinished,
  isKeyReturnComplete,
} from '@/lib/key-access-workflow';
import { jobLookupMiss } from '@/lib/job-lookup';

function viewingTimes(viewing: InspectorOpenViewing, endTime: string) {
  return {
    startTime: viewing.openedAt ?? viewing.startTime,
    endTime,
  };
}

export default function OpenInspectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    getJob,
    updateJobStatus,
    completeOpenInspectionJob,
    finishInspectionWorkflow,
    updateJobWorkflow,
    refresh,
    jobsHydrated,
  } = useInspectorData();
  const job = getJob(id);
  const { celebrate, Celebration } = useFinishInspection(id);
  const paymentCleared = useAwaitingAgentPaymentGate(job, id);
  const keysCollected = useKeyCollectGate(job, id);
  useInspectionFinishedGate(job, id);
  useInspectionInProgress(job, id, updateJobStatus);

  useEffect(() => {
    if (searchParams.get('view') === 'areas') {
      router.replace(jobInspect(id, 'open'));
    }
  }, [id, router, searchParams]);

  const [viewing, setViewing] = useState<InspectorOpenViewing | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const autoCompleteTriggered = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const session = await fetchOpenViewing(id);
        if (cancelled) return;
        setViewing(session);
        if (
          session &&
          !session.canCompleteEarly &&
          session.sessionStatus !== 'open' &&
          job?.status !== 'completed'
        ) {
          void refresh();
        }
      } catch {
        if (!cancelled) setViewing(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const poll =
      job?.status === 'completed'
        ? undefined
        : window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      if (poll) window.clearInterval(poll);
    };
  }, [id, job?.status, refresh]);

  const isBeforeScheduledStart = Boolean(
    viewing?.canStart && now < new Date(viewing.startTime).getTime(),
  );

  const windowEnded = Boolean(
    viewing && now >= new Date(viewing.endTime).getTime(),
  );

  const isCompleted = job?.status === 'completed';
  const workflowFinished = job ? isInspectionWorkflowFinished(job) : false;
  const returnPending =
    Boolean(job?.keyAccess) &&
    workflowFinished &&
    Boolean(job && !isKeyReturnComplete(job)) &&
    !isCompleted;
  const canCompleteEarly =
    Boolean(viewing?.canCompleteEarly) && !isCompleted && !workflowFinished;
  const isLive =
    Boolean(viewing) &&
    !viewing?.canStart &&
    !workflowFinished &&
    !isCompleted &&
    (canCompleteEarly || viewing?.sessionStatus === 'open');

  const { checkIns, interested } = useMemo(
    () => splitOpenInspectionVisitors(viewing?.visitors ?? []),
    [viewing?.visitors],
  );

  const clock = viewing
    ? formatOpenInspectionClock(viewing.endTime, now)
    : '—';
  const remainingRatio = viewing
    ? openInspectionRemainingRatio(
        viewing.originalScheduledStart ?? viewing.startTime,
        viewing.endTime,
        now,
      )
    : 0;

  const finishedAt =
    viewing?.closedAt ??
    (typeof job?.workflowData?.inspectionFinishedAt === 'string'
      ? job.workflowData.inspectionFinishedAt
      : null);
  const earlyTimingNotice = formatOpenInspectionEarlyTimingNotice({
    startedEarly: viewing?.startedEarly,
    startedEarlyAt: viewing?.startedEarlyAt,
    originalScheduledStart: viewing?.originalScheduledStart,
    finishedAt,
    scheduledEnd: viewing?.endTime,
  });

  const runComplete = useCallback(
    async (early: boolean) => {
      if (!viewing || completing || isCompleted || workflowFinished) return false;

      setCompleting(true);
      try {
        const needsKeyReturn =
          Boolean(job?.keyAccess && job && !isKeyReturnComplete(job));

        if (needsKeyReturn) {
          const outcome = finishInspectionWorkflow(id);
          if (outcome === 'needs_key_return') {
            celebrate(
              'Return the keys to complete this task.',
              'keys',
              'Viewing ended',
            );
            return true;
          }
        }

        const endTime = early ? new Date().toISOString() : viewing.endTime;
        const ok = await completeOpenInspectionJob(
          id,
          viewingTimes(viewing, endTime),
        );
        if (!ok) {
          toast.error('Could not complete job');
          return false;
        }

        celebrate(
          early
            ? 'Open inspection finished early.'
            : 'Viewing window ended — job completed automatically.',
        );
        return true;
      } finally {
        setCompleting(false);
      }
    },
    [
      viewing,
      completing,
      isCompleted,
      workflowFinished,
      job,
      finishInspectionWorkflow,
      completeOpenInspectionJob,
      id,
      celebrate,
    ],
  );

  useEffect(() => {
    if (!canCompleteEarly || !windowEnded || autoCompleteTriggered.current) {
      return;
    }
    autoCompleteTriggered.current = true;
    void runComplete(false);
  }, [canCompleteEarly, windowEnded, runComplete]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const session = await startOpenViewing(id);
      setViewing(session);
      if (session.startedEarly) {
        updateJobWorkflow(id, job?.workflowStep ?? 1, {
          startedEarly: true,
          startedEarlyAt: session.startedEarlyAt,
          originalScheduledStart: session.originalScheduledStart,
        });
      }
      toast.success(
        session.startedEarly
          ? 'Open inspection started early — end time unchanged'
          : 'Open inspection is now live',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not start open inspection');
    } finally {
      setStarting(false);
    }
  };

  const handleCompleteEarly = () => {
    void runComplete(true);
  };

  if (!job) {
    return (
      <JobLookupFallback
        state={jobLookupMiss(jobsHydrated)}
        backHref={ROUTES.INSPECTIONS}
      />
    );
  }

  if (!paymentCleared) {
    return (
      <JobWorkspaceShell job={job} active="start">
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-700 dark:text-amber-300">
          Waiting for the agency to pay the platform fee before you can start
          this job.
        </p>
      </JobWorkspaceShell>
    );
  }

  if (!keysCollected) {
    return <KeyCollectionRequired jobId={id} />;
  }

  return (
    <>
      <JobWorkspaceShell job={job} active="start">
        {returnPending ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <KeyRound
                className="text-primary mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">Return the keys to complete</p>
                <p className="text-muted-foreground text-sm">
                  The viewing has ended. Hand the keys back — the job is only
                  complete after that handover is recorded.
                </p>
                {earlyTimingNotice ? (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {earlyTimingNotice}.
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => window.location.assign(jobKeys(id, 'return'))}
            >
              Continue to handover
            </Button>
            <OpenInspectionReferenceTabs
              inspectionId={id}
              viewing={viewing}
              loading={loading}
            />
          </div>
        ) : (
        <>
        <div className={cn('space-y-4', isLive ? 'pb-28' : 'pb-6')}>
          {viewing?.awaitingAgentPayment ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              Waiting for the agency to pay the platform fee before you can start
              this open inspection.
            </p>
          ) : viewing?.canStart ? (
            <div className="border-border bg-card space-y-3 rounded-2xl border p-4">
              <p className="text-sm font-semibold">
                {formatTime(viewing.startTime)} – {formatTime(viewing.endTime)}
              </p>
              <p className="text-muted-foreground text-xs">
                Start the open inspection to open check-in and application links
                for prospects.
              </p>
              <Button
                type="button"
                className="w-full"
                disabled={starting}
                onClick={() => void handleStart()}
              >
                {starting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Starting…
                  </>
                ) : isBeforeScheduledStart ? (
                  'Start early'
                ) : (
                  'Start open inspection'
                )}
              </Button>
            </div>
          ) : (isLive || isCompleted) && viewing ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-400" />
                        Open now
                      </span>
                    )}
                    {!isCompleted ? (
                      <span className="text-muted-foreground text-xs">
                        Ends {formatTime(viewing.endTime)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-foreground text-lg font-semibold leading-tight">
                    {formatTime(viewing.startTime)} – {formatTime(viewing.endTime)}
                  </p>
                  {earlyTimingNotice ? (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {earlyTimingNotice}.
                    </p>
                  ) : null}
                </div>
                {!isCompleted ? (
                  <OpenInspectionCountdown
                    clock={clock}
                    ratio={remainingRatio}
                    ended={windowEnded || isCompleted}
                  />
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="border-border bg-card rounded-2xl border px-3 py-3">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                    <Users className="size-3.5" />
                    Checked in
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {checkIns.length}
                  </p>
                </div>
                <div className="border-border bg-card rounded-2xl border px-3 py-3">
                  <p className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                    <Star className="size-3.5" />
                    Interested
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {interested.length}
                  </p>
                </div>
              </div>

              {isLive ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Finish early anytime during the viewing, or this job completes
                  automatically when the window ends.
                </p>
              ) : null}
            </>
          ) : null}

          <OpenInspectionReferenceTabs
            inspectionId={id}
            viewing={viewing}
            loading={loading}
            startPending={Boolean(viewing?.canStart) && !isCompleted}
            missingLabel="Viewing links are not available for this job yet. Accept the job and refresh — if this persists, contact CROSSUB support."
          />
        </div>

        {isLive && viewing ? (
          <div
            className="bg-background/95 fixed inset-x-0 z-40 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mx-auto max-w-lg">
              {canCompleteEarly ? (
                <Button
                  variant="outline"
                  className="h-12 w-full gap-2 rounded-xl border-red-500 bg-transparent text-red-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-400 dark:bg-transparent"
                  disabled={completing}
                  onClick={handleCompleteEarly}
                >
                  {completing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Ending…
                    </>
                  ) : windowEnded ? (
                    'Ending…'
                  ) : (
                    <>
                      <Radio className="size-4" />
                      End open inspection
                    </>
                  )}
                </Button>
              ) : windowEnded ? (
                <Button className="h-12 w-full" disabled>
                  <Loader2 className="size-4 animate-spin" />
                  Completing…
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
        </>
        )}
      </JobWorkspaceShell>
      {Celebration}
    </>
  );
}
