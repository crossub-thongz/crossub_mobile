import type { InspectorKeyCollection, InspectorKeyCustody } from '@/src/api/inspector';
import {
  parseHandoverExtrasFromNotes,
  type KeyPhaseRecord,
  type KeyWorkflowData,
} from '@/src/lib/handover-notes';
import type {
  InspectionJob,
  InspectorLeasingKeyContext,
  KeyAccess,
  LeasingItemStatus,
  LeasingKeyCollectionState,
  LeasingKeyCustody,
} from '@/src/lib/types';

const KEY_WORKFLOW_KEY = 'keyWorkflow';

export function keyAccessFromCollection(data: {
  keyCustody: string;
  photoRequired: boolean;
  custody: { collectComplete: boolean; returnComplete: boolean };
  keyCollection?: { location?: string | null };
}): KeyAccess {
  const location = data.keyCollection?.location?.trim();
  return {
    method:
      data.keyCustody === 'agent'
        ? 'agent'
        : data.keyCustody === 'crossub'
          ? 'office'
          : 'tenant',
    collectComplete: data.custody.collectComplete,
    returnComplete: data.custody.returnComplete,
    photoRequired: data.photoRequired,
    location: location || undefined,
  };
}

export function mapKeyCollectionFromApi(dto: InspectorKeyCollection): {
  leasingKeyCollection: InspectorLeasingKeyContext;
  keyAccess: KeyAccess;
} {
  const keyCustody: LeasingKeyCustody = dto.keyCustody === 'agent' ? 'agent' : 'crossub';
  const keyCollection: LeasingKeyCollectionState = {
    status: (dto.keyCollection.status ?? 'not_started') as LeasingItemStatus,
    time: dto.keyCollection.time ?? null,
    location: dto.keyCollection.location ?? null,
    photos: dto.keyCollection.photos ?? [],
    tenantReport: dto.keyCollection.tenantReport ?? null,
  };
  return {
    leasingKeyCollection: {
      cycleId: dto.cycleId,
      propertyId: dto.propertyId,
      propertyAddress: dto.propertyAddress,
      keyCustody,
      keyCollection,
    },
    keyAccess: keyAccessFromCollection(dto),
  };
}

export function getKeyWorkflow(job: InspectionJob): KeyWorkflowData | undefined {
  const raw = job.workflowData?.[KEY_WORKFLOW_KEY];
  if (!raw || typeof raw !== 'object') return undefined;
  return raw as KeyWorkflowData;
}

function phaseFromCustody(
  complete: boolean,
  at: string | null | undefined,
  photos: string[] | undefined,
  notes: string | null | undefined,
): KeyPhaseRecord | undefined {
  if (!complete) return undefined;
  const extras = parseHandoverExtrasFromNotes(notes);
  return {
    completedAt: at ?? '',
    photoUrls: photos ?? [],
    notes: extras.notes,
    handoverParty: extras.handoverParty,
    keySets: extras.keySets,
    keyCondition: extras.keyCondition,
    contactName: extras.contactName,
    contactPhone: extras.contactPhone,
    contactEmail: extras.contactEmail,
    agencyName: extras.agencyName,
  };
}

export function keyWorkflowFromCustody(
  custody: InspectorKeyCustody | null | undefined,
): KeyWorkflowData | undefined {
  if (!custody) return undefined;
  const collect = phaseFromCustody(
    custody.collectComplete,
    custody.collectedAt,
    custody.collectPhotos,
    custody.collectNotes,
  );
  const ret = phaseFromCustody(
    custody.returnComplete,
    custody.returnedAt,
    custody.returnPhotos,
    custody.returnNotes,
  );
  if (!collect && !ret) return undefined;
  return { collect, return: ret };
}

export function applyKeyCollection(
  job: InspectionJob,
  dto: InspectorKeyCollection,
): InspectionJob {
  const mapped = mapKeyCollectionFromApi(dto);
  const serverWorkflow = keyWorkflowFromCustody(dto.custody);
  const localWorkflow = getKeyWorkflow(job);
  const keyWorkflow: KeyWorkflowData = {
    collect: serverWorkflow?.collect ?? localWorkflow?.collect,
    return: serverWorkflow?.return ?? localWorkflow?.return,
  };
  return {
    ...job,
    keyAccess: mapped.keyAccess,
    leasingKeyCollection: mapped.leasingKeyCollection,
    workflowData: {
      ...job.workflowData,
      [KEY_WORKFLOW_KEY]: keyWorkflow,
    },
  };
}

export function hasTenantKeyReport(keyCollection: LeasingKeyCollectionState): boolean {
  return keyCollection.tenantReport != null;
}

export function hasKeyCollectionPhotos(keyCollection: LeasingKeyCollectionState): boolean {
  return (keyCollection.photos?.length ?? 0) > 0;
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

export function canAccessKeyReturnTab(job: InspectionJob): boolean {
  if (!job.keyAccess) return false;
  if (!isKeyCollectComplete(job)) return false;
  return isInspectionWorkflowFinished(job);
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
  const count = job.leasingKeyCollection?.keyCollection.tenantReport?.keysCount ?? null;
  if (count != null && count >= 0) {
    return `${count} set${count === 1 ? '' : 's'}`;
  }
  if (job.keyAccess) return '1 set';
  return '-';
}

export function withKeyPhase(
  job: InspectionJob,
  phase: 'collect' | 'return',
  record: KeyPhaseRecord,
  flags: { collectComplete: boolean; returnComplete: boolean },
): Partial<InspectionJob> {
  if (!job.keyAccess) return {};
  return {
    keyAccess: {
      ...job.keyAccess,
      collectComplete: flags.collectComplete,
      returnComplete: flags.returnComplete,
    },
    workflowData: {
      ...job.workflowData,
      [KEY_WORKFLOW_KEY]: {
        ...getKeyWorkflow(job),
        [phase]: record,
      },
    },
  };
}
