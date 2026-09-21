import { getKeyWorkflow } from '@/src/lib/key-access';
import type { InspectionJob } from '@/src/lib/types';

function urlsFromRecord(record: unknown): string[] {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return [];
  return Object.values(record).filter(
    (url): url is string => typeof url === 'string' && url.length > 0,
  );
}

export function historyProofPhotoCount(job: InspectionJob): number {
  const data = job.workflowData ?? {};
  const keyWorkflow = getKeyWorkflow(job);
  return (
    urlsFromRecord(data.readinessPhotos).length +
    urlsFromRecord(data.finishPhotos).length +
    (keyWorkflow?.collect?.photoUrls?.length ?? 0) +
    (keyWorkflow?.return?.photoUrls?.length ?? 0)
  );
}

export function historyProofLabel(count: number): string {
  if (count <= 0) return '';
  return ` - ${count} proof photo${count === 1 ? '' : 's'}`;
}
