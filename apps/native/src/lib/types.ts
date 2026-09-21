import type { CustomAreaDefinition } from '@/src/lib/custom-inspection-areas';
import type { ItemConditionMarks } from '@/src/lib/item-condition-marks';
import type { SpecialReportingDraft } from '@/src/lib/special-reporting';

export type InspectionType =
  | 'open'
  | 'ingoing'
  | 'outgoing'
  | 'routine'
  | 'tribunal';

export type JobStatus =
  | 'available'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_approval'
  | 'completed'
  | 'declined';

export type JobSource = 'pool' | 'assigned';

export type PropertyInspectionSpec = {
  propertyKind: 'house' | 'apartment';
  bedrooms: number;
  bathrooms: number;
};

export type KeyAccess = {
  method: 'lockbox' | 'office' | 'agent' | 'tenant';
  collectComplete: boolean;
  returnComplete: boolean;
  photoRequired: boolean;
  code?: string;
  location?: string;
};

export type LeasingKeyCustody = 'crossub' | 'agent';

export type LeasingItemStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting'
  | 'blocked'
  | 'done';

export type LeasingKeyCollectionTenantReport = {
  submittedAt: string | null;
  tagNumber: string | null;
  keysCount: number | null;
  entryDoorCount: number | null;
  windowSlidingCount: number | null;
  fobsCount: number | null;
  remoteControlCount: number | null;
  mailboxCount: number | null;
  othersCount: number | null;
};

export type LeasingKeyCollectionState = {
  status: LeasingItemStatus;
  time: string | null;
  location: string | null;
  photos: string[];
  tenantReport: LeasingKeyCollectionTenantReport | null;
};

export type InspectorLeasingKeyContext = {
  cycleId: string;
  propertyId: string;
  propertyAddress: string;
  keyCustody: LeasingKeyCustody;
  keyCollection: LeasingKeyCollectionState;
};

export type InspectionJob = {
  id: string;
  type: InspectionType;
  propertyAddress: string;
  suburb: string;
  latitude?: number;
  longitude?: number;
  scheduledDate: string;
  scheduledTime: string;
  createdAt?: string;
  priority: 'urgent' | 'normal';
  status: JobStatus;
  source: JobSource;
  assignedBy?: string;
  tenantName?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  agentName?: string;
  agentCompany?: string;
  agentEmail?: string;
  agentPhone?: string;
  propertyImageUrl?: string;
  keyAccess?: KeyAccess;
  leasingKeyCollection?: InspectorLeasingKeyContext;
  notes?: string;
  property: PropertyInspectionSpec;
  durationLabel: string;
  estimatedHours: number;
  laborAmount: number;
  payAmount: number;
  workflowStep?: number;
  workflowData?: Record<string, unknown>;
  leaseStart?: string;
  leaseEnd?: string;
  reportDeclineReason?: string;
  approvedAt?: string;
  reportUrl?: string;
  awaitingAgentPayment?: boolean;
};

export type RoutineAreaIssueDraft = {
  available: boolean | null;
  notes: string;
  areaPhotos: string[];
  itemMarks?: Record<string, ItemConditionMarks>;
  itemComments?: Record<string, string>;
  activeSections?: string[];
  photosBySection?: Record<string, { ingoingPhotoUrls: string[]; outgoingPhotoUrls: string[] }>;
  responsibility?: string;
};

export type RoutineExecutionDraft = {
  kind: 'routine' | 'ingoing' | 'outgoing';
  areaIndex: number;
  method: 'physical' | 'self';
  issues: Record<string, RoutineAreaIssueDraft>;
  selectedAreaNames?: string[];
  customAreas?: CustomAreaDefinition[];
  areaSetupComplete?: boolean;
  updatedAt?: string;
  specialReporting?: SpecialReportingDraft;
  specialReportingComplete?: boolean;
  workflowStep?: 'areas' | 'special';
};
