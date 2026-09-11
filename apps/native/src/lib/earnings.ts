import type { InspectorJob } from '@/src/api/inspector';
import {
  INSPECTOR_HOURLY_RATE_AUD,
  ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD,
} from '@/src/constants/inspection';
import { BILLING_SOURCE, INVOICE_STATUS } from '@/src/constants/inspections';
import type { InspectionType } from '@/src/lib/types';

export type EarningsRecord = {
  id: string;
  type: InspectionType;
  propertyAddress: string;
  completedAt: string;
  hoursWorked: number;
  hourlyRate: number;
  laborAmount: number;
  accountingSynced: boolean;
};

function earningsTypeFromJob(dto: InspectorJob): InspectionType {
  if (dto.source === BILLING_SOURCE.TRIBUNAL) return 'tribunal';
  const label = dto.sourceLabel?.toLowerCase() ?? '';
  if (label.startsWith('open inspection')) return 'open';
  if (label.startsWith('ingoing inspection')) return 'ingoing';
  if (label.startsWith('outgoing inspection')) return 'outgoing';
  if (label.startsWith('routine inspection')) return 'routine';
  return 'routine';
}

export function toEarningsRecord(dto: InspectorJob): EarningsRecord {
  const type = earningsTypeFromJob(dto);
  const apiAmount = dto.totalAmount ?? 0;
  const apiHours = dto.billableHours ?? 0;
  const flatRoutineOpen = type === 'routine' || type === 'open';
  const laborAmount = flatRoutineOpen ? ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD : apiAmount;
  return {
    id: dto.id,
    type,
    propertyAddress: dto.propertyLabel ?? dto.sourceLabel,
    completedAt: dto.submittedAt ?? dto.endTime ?? '',
    hoursWorked: flatRoutineOpen ? 1 : apiHours,
    hourlyRate: dto.hourlyRate ?? INSPECTOR_HOURLY_RATE_AUD,
    laborAmount,
    accountingSynced: dto.invoiceStatus !== INVOICE_STATUS.PENDING,
  };
}

export function mapInspectorEarnings(dtos: InspectorJob[]): EarningsRecord[] {
  return dtos.map(toEarningsRecord);
}
