export type HandoverParty = 'tenant' | 'agent';
export type KeyCondition = 'good' | 'damaged';

export type HandoverExtras = {
  notes?: string;
  handoverParty?: HandoverParty;
  keySets?: number;
  keyCondition?: KeyCondition;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  agencyName?: string;
};

export type KeyPhaseRecord = HandoverExtras & {
  completedAt: string;
  photoUrls: string[];
};

export type KeyWorkflowData = {
  collect?: KeyPhaseRecord;
  return?: KeyPhaseRecord;
};

/** Persist handover extras in the notes field the key-custody API already stores. */
export function formatHandoverNotes(
  record: HandoverExtras,
  phase: 'collect' | 'return' = 'collect',
): string | undefined {
  const lines: string[] = [];
  if (record.handoverParty) {
    const label =
      phase === 'return' ? 'Handover (returning keys)' : 'Handover (collecting keys)';
    lines.push(`${label} with ${record.handoverParty}`);
  }
  if (record.contactName) lines.push(`Contact: ${record.contactName}`);
  if (record.agencyName) lines.push(`Agency: ${record.agencyName}`);
  if (record.contactPhone) lines.push(`Phone: ${record.contactPhone}`);
  if (record.contactEmail) lines.push(`Email: ${record.contactEmail}`);
  if (record.keySets != null) lines.push(`Key sets: ${record.keySets}`);
  if (record.keyCondition) lines.push(`Condition: ${record.keyCondition}`);
  if (record.notes?.trim()) lines.push(record.notes.trim());
  return lines.length ? lines.join('\n') : undefined;
}

const HANDOVER_PARTY_RE = /Handover(?: \([^)]+\))? with (tenant|agent)/i;
const STRUCTURED_LINE_RE =
  /^(Contact|Agency|Phone|Email|Key sets|Condition):|^Handover(?: \([^)]+\))? with /i;

export function parseHandoverPartyFromNotes(
  notes: string | null | undefined,
): HandoverParty | undefined {
  if (!notes) return undefined;
  const match = notes.match(HANDOVER_PARTY_RE);
  return match ? (match[1].toLowerCase() as HandoverParty) : undefined;
}

function matchLine(notes: string, label: string): string | undefined {
  const match = notes.match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  const value = match?.[1]?.trim();
  return value ? value : undefined;
}

export function parseHandoverExtrasFromNotes(
  notes: string | null | undefined,
): HandoverExtras {
  if (!notes) return {};
  const keySetsRaw = matchLine(notes, 'Key sets');
  const keySets = keySetsRaw != null ? Number.parseInt(keySetsRaw, 10) : Number.NaN;
  const conditionRaw = matchLine(notes, 'Condition')?.toLowerCase();
  const freeNotes = notes
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !STRUCTURED_LINE_RE.test(line))
    .join('\n');
  return {
    handoverParty: parseHandoverPartyFromNotes(notes),
    contactName: matchLine(notes, 'Contact'),
    agencyName: matchLine(notes, 'Agency'),
    contactPhone: matchLine(notes, 'Phone'),
    contactEmail: matchLine(notes, 'Email'),
    keySets: Number.isFinite(keySets) ? keySets : undefined,
    keyCondition: conditionRaw === 'damaged' ? 'damaged' : conditionRaw === 'good' ? 'good' : undefined,
    notes: freeNotes || undefined,
  };
}

