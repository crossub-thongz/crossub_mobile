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
