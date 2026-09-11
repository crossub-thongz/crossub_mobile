import type { InspectionJob, KeyAccess } from '@/src/lib/types';

export function keyAccessFromCollection(data: {
  keyCustody: string;
  photoRequired: boolean;
  custody: { collectComplete: boolean; returnComplete: boolean };
}): KeyAccess {
  return {
    method: data.keyCustody === 'agent' ? 'agent' : 'tenant',
    collectComplete: data.custody.collectComplete,
    returnComplete: data.custody.returnComplete,
    photoRequired: data.photoRequired,
  };
}

export function isKeyCollectComplete(job: InspectionJob): boolean {
  if (!job.keyAccess) return true;
  return job.keyAccess.collectComplete;
}

export function isKeyReturnComplete(job: InspectionJob): boolean {
  if (!job.keyAccess) return true;
  return job.keyAccess.returnComplete;
}

export function isInspectionWorkflowFinished(job: InspectionJob): boolean {
  if (job.status === 'completed' || job.status === 'awaiting_approval') return true;
  return job.workflowData?.inspectionFinished === true;
}

export function jobAccessMethodLabel(job: InspectionJob): string {
  const method = job.keyAccess?.method;
  if (method === 'lockbox') return 'Collect from lockbox';
  if (method === 'office') return 'Collect from office';
  if (method === 'agent') return 'Collect from agent';
  if (job.tenantName) return 'Meet with tenant';
  return '-';
}

export function jobKeysCountLabel(job: InspectionJob): string {
  if (job.keyAccess) return '1 set';
  return '-';
}
