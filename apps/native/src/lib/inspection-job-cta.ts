import { jobStartCta } from '@/src/lib/inspection-start-flow';
import { isKeyCollectComplete } from '@/src/lib/key-access';
import { jobAreas, jobDetail, jobHistory, jobInspect } from '@/src/lib/routes';
import type { InspectionJob, RoutineExecutionDraft } from '@/src/lib/types';

export function canReopenInspection(job: InspectionJob): boolean {
  return Boolean(job.reportDeclineReason) && job.status !== 'completed';
}

export function hasInspectionExecutionDraft(
  job: InspectionJob,
  localDraft?: RoutineExecutionDraft | null,
): boolean {
  if (localDraft && (localDraft.areaSetupComplete || (localDraft.selectedAreaNames?.length ?? 0) > 0)) {
    return true;
  }
  const raw = job.workflowData?.inspectionDraft;
  return Boolean(raw && typeof raw === 'object');
}

export function jobInspectionStarted(
  job: InspectionJob,
  localDraft?: RoutineExecutionDraft | null,
): boolean {
  return (job.workflowStep ?? 0) > 0 || hasInspectionExecutionDraft(job, localDraft);
}

export function jobInspectionContinuing(
  job: InspectionJob,
  localDraft?: RoutineExecutionDraft | null,
): boolean {
  if (jobInspectionStarted(job, localDraft)) return true;
  return Boolean(job.keyAccess && isKeyCollectComplete(job));
}

export type JobPrimaryAction = {
  label: string;
  href: string;
  disabled: boolean;
};

export function inspectListCtaLabel(
  job: InspectionJob,
  action: JobPrimaryAction,
  compact = false,
  localDraft?: RoutineExecutionDraft | null,
): string {
  if (action.disabled || action.label === 'Re-Open') return action.label;
  if (jobInspectionContinuing(job, localDraft)) {
    return compact ? 'Continue' : 'Continue Inspection';
  }
  return compact ? 'Start' : 'Start Inspection';
}

export function jobPrimaryAction(
  job: InspectionJob,
  started: boolean,
): JobPrimaryAction {
  if (job.status === 'completed') {
    return { label: 'View report', href: jobHistory(job.id), disabled: false };
  }
  if (canReopenInspection(job)) {
    return { label: 'Re-Open', href: jobInspect(job.id, job.type), disabled: false };
  }
  if (job.status === 'awaiting_approval') {
    return { label: 'Pending Approval', href: jobDetail(job.id), disabled: true };
  }
  if (job.awaitingAgentPayment) {
    return { label: 'Awaiting payment', href: jobDetail(job.id), disabled: true };
  }
  const continuing = started || jobInspectionContinuing(job);
  const href =
    job.type === 'open'
      ? jobInspect(job.id, job.type)
      : job.keyAccess && !isKeyCollectComplete(job)
        ? jobDetail(job.id)
        : started
          ? jobInspect(job.id, job.type)
          : jobAreas(job.id, job.type);
  return {
    label: jobStartCta(job.type, continuing),
    href,
    disabled: false,
  };
}
