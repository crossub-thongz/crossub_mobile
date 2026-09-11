import type { InspectorTribunalCaseDto } from '@/src/api/inspector';
import {
  TRIBUNAL_OUTCOME_LABEL,
  TRIBUNAL_STATUS_LABEL,
  TRIBUNAL_TYPE_LABEL,
} from '@/src/constants/tribunal';

export type TribunalHearing = {
  id: string;
  caseNumber: string;
  status: InspectorTribunalCaseDto['status'];
  statusLabel: string;
  tribunalType: string;
  caseSummary: string;
  propertyAddress: string;
  suburb: string | null;
  hearingDate: string;
  hearingTime: string;
  hearingFormat: string | null;
  location: string;
  amountClaimed: number | null;
  bondAmount: number | null;
  outstandingRent: number | null;
  evidence: Array<{ title: string; category: string; present: boolean }>;
  evidenceComplete: boolean;
  hearingConfirmed: boolean;
  attendanceRecorded: boolean;
  outcomeLabel: string | null;
  closed: boolean;
};

export function toTribunalHearing(dto: InspectorTribunalCaseDto): TribunalHearing {
  const outcome = dto.outcomeResult
    ? (TRIBUNAL_OUTCOME_LABEL[dto.outcomeResult as keyof typeof TRIBUNAL_OUTCOME_LABEL] ??
      dto.outcomeResult)
    : null;
  return {
    id: dto.id,
    caseNumber: dto.caseNumber,
    status: dto.status,
    statusLabel: TRIBUNAL_STATUS_LABEL[dto.status] ?? dto.status,
    tribunalType: TRIBUNAL_TYPE_LABEL[dto.tribunalType] ?? dto.tribunalType,
    caseSummary: dto.caseSummary,
    propertyAddress: dto.propertyAddress,
    suburb: dto.suburb,
    hearingDate: dto.hearingDate?.slice(0, 10) ?? '',
    hearingTime: dto.hearingTime ?? '',
    hearingFormat: dto.hearingFormat,
    location: dto.hearingLocation ?? dto.tribunalBody ?? 'To be advised',
    amountClaimed: dto.amountClaimed,
    bondAmount: dto.bondAmount,
    outstandingRent: dto.outstandingRent,
    evidence: dto.evidence.map((item) => ({
      title: item.title,
      category: item.category,
      present: item.present,
    })),
    evidenceComplete: dto.evidenceComplete,
    hearingConfirmed: Boolean(dto.hearingDate),
    attendanceRecorded: dto.attendanceRecorded,
    outcomeLabel: outcome,
    closed: dto.closed,
  };
}
