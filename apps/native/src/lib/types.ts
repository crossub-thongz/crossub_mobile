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
};

export type RoutineExecutionDraft = {
  kind: 'routine' | 'ingoing' | 'outgoing';
  areaIndex: number;
  method: 'physical' | 'self';
  issues: Record<string, RoutineAreaIssueDraft>;
  selectedAreaNames?: string[];
  areaSetupComplete?: boolean;
  updatedAt?: string;
};
