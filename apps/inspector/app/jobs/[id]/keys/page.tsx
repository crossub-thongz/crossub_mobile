'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { HandoverCollectForm } from '@/components/inspector/handover-collect-form';
import { JobWorkspaceNav } from '@/components/inspector/job-workspace-nav';
import { JobPropertyHeader } from '@/components/inspector/job-property-header';
import { KeyPhasePhotoField } from '@/components/inspector/key-phase-photo-field';
import { LeasingKeyCollectionPanel } from '@/components/inspector/leasing-key-collection-panel';
import { NoImageDialog } from '@/components/inspector/no-image-dialog';
import { JobLookupFallback } from '@/components/inspector/job-lookup-fallback';
import { InspectorShell } from '@/components/layout/inspector-shell';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { useDeviceLocation } from '@/lib/use-device-position';
import { Button } from '@/components/ui/button';
import { INSPECTION_PAY_LABEL } from '@/constants/inspection';
import { jobAreas, jobDetail, jobInspect } from '@/constants/routes';
import {
  useAwaitingAgentPaymentGate,
  useKeyReturnGate,
} from '@/hooks/use-key-collect-gate';
import {
  canAccessKeyReturnTab,
  getKeyWorkflow,
  isKeyCollectComplete,
  isKeyReturnComplete,
  type KeyPhaseRecord,
} from '@/lib/key-access-workflow';
import { cn, formatDateTime } from '@/lib/utils';
import { jobLookupMiss } from '@/lib/job-lookup';

type Tab = 'collect' | 'return';

export default function JobKeysPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'return' ? 'return' : 'collect';
  const { getJob, saveKeyWorkflow, completeJob, refresh, jobsHydrated, profile } =
    useInspectorData();
  const deviceLocation = useDeviceLocation();
  const job = getJob(id);

  const [tab, setTab] = useState<Tab>(initialTab);
  const [submitting, setSubmitting] = useState(false);
  const [noImageOpen, setNoImageOpen] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'return' || tabParam === 'collect') {
      setTab(tabParam);
    }
  }, [searchParams]);

  const paymentCleared = useAwaitingAgentPaymentGate(job, id);
  const workflow = job ? getKeyWorkflow(job) : undefined;
  const collectDone = job ? isKeyCollectComplete(job) : false;
  const returnDone = job ? isKeyReturnComplete(job) : false;
  const returnUnlocked = job ? canAccessKeyReturnTab(job) : false;

  useKeyReturnGate(job, id, tab);

  const phaseRecord = tab === 'collect' ? workflow?.collect : workflow?.return;

  useEffect(() => {
    void refresh();
  }, [id, refresh]);

  if (!job) {
    return (
      <JobLookupFallback
        state={jobLookupMiss(jobsHydrated)}
        backHref={jobDetail(id)}
        missingTitle="Handover"
      />
    );
  }

  if (!paymentCleared) {
    return null;
  }

  if (!job.keyAccess) {
    return (
      <InspectorShell
        title={`${INSPECTION_PAY_LABEL[job.type] ?? job.type} Inspection`}
        backHref={jobDetail(id)}
        variant="workspace"
      >
        <JobWorkspaceNav job={job} active="handover" />
        <p className="text-muted-foreground mt-4 text-sm">
          No key collection required for this job.
        </p>
        <Link href={jobDetail(id)}>
          <Button className="mt-4 w-full">Back to job</Button>
        </Link>
      </InspectorShell>
    );
  }

  const switchTab = (next: Tab) => {
    if (next === 'return' && !returnUnlocked) {
      toast.error('Finish the inspection before returning keys.');
      return;
    }
    setTab(next);
  };

  const submitCollect = async (record: KeyPhaseRecord) => {
    if (collectDone) return;
    try {
      setSubmitting(true);
      await saveKeyWorkflow(id, 'collect', record);
    } catch {
      return;
    } finally {
      setSubmitting(false);
    }
    toast.success('Handover recorded');
    router.replace(
      job.type === 'open'
        ? jobInspect(id, job.type)
        : jobAreas(id, job.type),
    );
  };

  const submitReturn = async (record: KeyPhaseRecord) => {
    if (returnDone) return;
    try {
      setSubmitting(true);
      await saveKeyWorkflow(id, 'return', record);
    } catch {
      return;
    } finally {
      setSubmitting(false);
    }

    toast.success('Handover recorded · keys returned');
    setTimeout(() => {
      completeJob(id);
      router.replace(jobDetail(id));
    }, 0);
  };

  const completedView = (phaseLabel: string) => (
    <div className="space-y-4">
      <JobPropertyHeader job={job} inspectorName={profile.name} />
      <div className="space-y-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>
            Handover completed · {phaseLabel}
            {phaseRecord?.completedAt
              ? ` · ${formatDateTime(phaseRecord.completedAt)}`
              : ''}
          </span>
        </div>
        {phaseRecord?.handoverParty ? (
          <p className="text-xs">
            With {phaseRecord.handoverParty}
            {phaseRecord.contactName ? ` · ${phaseRecord.contactName}` : ''}
          </p>
        ) : null}
        {(phaseRecord?.photoUrls?.length ?? 0) > 0 ? (
          <KeyPhasePhotoField
            label="Submitted photos"
            photos={phaseRecord?.photoUrls ?? []}
            onChange={() => undefined}
            disabled
          />
        ) : (
          <KeyPhasePhotoField
            label="Submitted photos"
            photos={[]}
            onChange={() => undefined}
            disabled
            onEmptyPress={() => setNoImageOpen(true)}
          />
        )}
        {phaseRecord?.notes && (
          <p className="text-muted-foreground whitespace-pre-wrap text-xs">
            {phaseRecord.notes}
          </p>
        )}
        <p className="text-muted-foreground text-[10px]">
          This step cannot be edited after submission.
        </p>
        <Link
          href={
            tab === 'collect' && job.type === 'open'
              ? jobInspect(id, job.type)
              : jobDetail(id)
          }
        >
          <Button className="w-full">
            {tab === 'collect' && job.type === 'open'
              ? 'Continue Inspection'
              : 'Back to job details'}
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <InspectorShell
      title={`${INSPECTION_PAY_LABEL[job.type] ?? job.type} Inspection`}
      backHref={jobDetail(id)}
      variant="workspace"
    >
      <JobWorkspaceNav job={job} active="handover" />
      <div className="space-y-5 pt-4">
        <div className="mb-1 flex gap-1.5 rounded-xl border bg-secondary/30 p-1.5">
          <button
            type="button"
            onClick={() => switchTab('collect')}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2.5 text-center transition',
              tab === 'collect'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground',
            )}
          >
            <span className="flex items-center gap-1 text-xs font-semibold">
              Handover
              {collectDone ? <CheckCircle2 className="size-3.5" /> : null}
            </span>
            <span className="text-[10px] leading-tight font-medium">
              Collecting keys
            </span>
          </button>
          <button
            type="button"
            onClick={() => switchTab('return')}
            disabled={!returnUnlocked}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2.5 text-center transition',
              tab === 'return'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground',
              !returnUnlocked && 'cursor-not-allowed opacity-40',
            )}
          >
            <span className="flex items-center gap-1 text-xs font-semibold">
              Handover
              {returnDone ? <CheckCircle2 className="size-3.5" /> : null}
            </span>
            <span className="text-[10px] leading-tight font-medium">
              Returning keys
            </span>
          </button>
        </div>

        {job.leasingKeyCollection && (
          <LeasingKeyCollectionPanel context={job.leasingKeyCollection} />
        )}

        {tab === 'collect' ? (
          collectDone ? (
            completedView('Collecting keys')
          ) : (
            <HandoverCollectForm
              job={job}
              mode="collect"
              inspectorName={profile.name}
              deviceLocation={deviceLocation}
              submitting={submitting}
              initial={phaseRecord}
              onSubmit={submitCollect}
            />
          )
        ) : returnDone ? (
          completedView('Returning keys')
        ) : (
          <HandoverCollectForm
            job={job}
            mode="return"
            inspectorName={profile.name}
            deviceLocation={deviceLocation}
            submitting={submitting}
            initial={phaseRecord}
            onSubmit={submitReturn}
          />
        )}
      </div>
      <NoImageDialog
        open={noImageOpen}
        onClose={() => setNoImageOpen(false)}
        message="Add at least one photo before completing this step."
      />
    </InspectorShell>
  );
}
