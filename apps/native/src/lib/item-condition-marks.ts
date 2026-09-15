export const ITEM_CONDITION_KEYS = ['clean', 'undamaged', 'working'] as const;

export type ItemConditionKey = (typeof ITEM_CONDITION_KEYS)[number];

export type ItemConditionMarks = {
  clean: boolean | null;
  undamaged: boolean | null;
  working: boolean | null;
};

export const ITEM_CONDITION_LABEL: Record<ItemConditionKey, string> = {
  clean: 'Clean',
  undamaged: 'Undamaged',
  working: 'Working',
};

export const ISSUE_DETAIL_LABEL: Record<ItemConditionKey, string> = {
  clean: 'Dirty / Needs cleaning',
  undamaged: 'Damaged / Broken',
  working: 'Not working',
};

const YES_TAG: Record<ItemConditionKey, string> = {
  clean: 'Clean',
  undamaged: 'Undamaged',
  working: 'Working',
};

const NO_TAG: Record<ItemConditionKey, string> = {
  clean: ISSUE_DETAIL_LABEL.clean,
  undamaged: ISSUE_DETAIL_LABEL.undamaged,
  working: ISSUE_DETAIL_LABEL.working,
};

const YES_LOOKUP = new Map(
  ITEM_CONDITION_KEYS.map((key) => [YES_TAG[key].toLowerCase(), key] as const),
);
const NO_LOOKUP = new Map<string, ItemConditionKey>([
  ...ITEM_CONDITION_KEYS.map((key) => [NO_TAG[key].toLowerCase(), key] as const),
  ['not clean', 'clean'],
  ['damaged', 'undamaged'],
]);

export function emptyItemMarks(): ItemConditionMarks {
  return { clean: null, undamaged: null, working: null };
}

export function mergeItemMarks(
  base: ItemConditionMarks | undefined,
  overlay: ItemConditionMarks | undefined,
): ItemConditionMarks {
  const left = base ?? emptyItemMarks();
  const right = overlay ?? emptyItemMarks();
  return {
    clean: right.clean ?? left.clean,
    undamaged: right.undamaged ?? left.undamaged,
    working: right.working ?? left.working,
  };
}

/** Fill one Clean / Undamaged / Working column across every item in the room. */
export function applyColumnMark(
  marksBySection: Record<string, ItemConditionMarks> | undefined,
  sections: readonly string[],
  key: ItemConditionKey,
  value: boolean,
): Record<string, ItemConditionMarks> {
  const next = { ...(marksBySection ?? {}) };
  for (const section of sections) {
    const current = next[section] ?? emptyItemMarks();
    next[section] = { ...current, [key]: value };
  }
  return next;
}

export function marksAreComplete(marks: ItemConditionMarks | undefined): boolean {
  if (!marks) return false;
  return ITEM_CONDITION_KEYS.every((key) => typeof marks[key] === 'boolean');
}

export function marksAreAllGood(marks: ItemConditionMarks | undefined): boolean {
  if (!marksAreComplete(marks) || !marks) return false;
  return ITEM_CONDITION_KEYS.every((key) => marks[key] === true);
}

export function allGoodMarks(): ItemConditionMarks {
  return { clean: true, undamaged: true, working: true };
}

export function marksHaveNo(marks: ItemConditionMarks | undefined): boolean {
  if (!marks) return false;
  return ITEM_CONDITION_KEYS.some((key) => marks[key] === false);
}

export function serializeItemMarks(marks: ItemConditionMarks | undefined): string[] {
  if (!marks) return [];
  const tags: string[] = [];
  for (const key of ITEM_CONDITION_KEYS) {
    if (marks[key] === true) tags.push(YES_TAG[key]);
    if (marks[key] === false) tags.push(NO_TAG[key]);
  }
  return tags;
}

/** One-line summary for reports: "Dirty / Needs cleaning · Undamaged · Working". */
export function formatItemMarksSummary(marks: ItemConditionMarks | undefined): string {
  return serializeItemMarks(marks).join(' · ');
}

export function itemReportComment(
  marks: ItemConditionMarks | undefined,
  note: string | undefined,
): string | undefined {
  const summary = formatItemMarksSummary(marks);
  const trimmed = note?.trim();
  if (summary && trimmed) return `${summary}. ${trimmed}`;
  if (summary) return summary;
  if (trimmed) return trimmed;
  return undefined;
}

/** Undo {@link itemReportComment} so the inspector's typed note is restored on reopen. */
export function stripItemMarksSummaryFromComment(
  comment: string | undefined,
  marks: ItemConditionMarks | undefined,
): string {
  const trimmed = comment?.trim() ?? '';
  if (!trimmed) return '';
  const summary = formatItemMarksSummary(marks);
  if (!summary) return trimmed;
  if (trimmed === summary) return '';
  const prefix = `${summary}. `;
  if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  return trimmed;
}

export function parseItemMarks(tags: readonly string[] | undefined): ItemConditionMarks {
  const marks = emptyItemMarks();
  for (const raw of tags ?? []) {
    const key = raw.trim().toLowerCase();
    const yes = YES_LOOKUP.get(key);
    if (yes) {
      marks[yes] = true;
      continue;
    }
    const no = NO_LOOKUP.get(key);
    if (no) marks[no] = false;
  }
  return marks;
}

export function firstIncompleteSection(
  sections: readonly string[],
  marksBySection: Record<string, ItemConditionMarks> | undefined,
): string | null {
  for (const section of sections) {
    if (!marksAreComplete(marksBySection?.[section])) return section;
  }
  return null;
}

export function areaRatingFromMarks(
  sections: readonly string[],
  marksBySection: Record<string, ItemConditionMarks> | undefined,
): 'Excellent' | 'Good' | 'Fair' | 'Poor' {
  if (sections.length === 0) return 'Good';
  let noCount = 0;
  let answered = 0;
  for (const section of sections) {
    const marks = marksBySection?.[section];
    if (!marks) continue;
    for (const key of ITEM_CONDITION_KEYS) {
      if (typeof marks[key] === 'boolean') answered += 1;
      if (marks[key] === false) noCount += 1;
    }
  }
  if (noCount === 0 && answered === sections.length * ITEM_CONDITION_KEYS.length) {
    return 'Excellent';
  }
  if (noCount === 0) return 'Good';
  if (noCount >= 4) return 'Poor';
  return 'Fair';
}
