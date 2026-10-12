import { type CustomAreaDefinition } from '@/lib/custom-inspection-areas';
import { INSPECTION_AREA_CATALOG, parseSectionAreaName } from '@/constants/inspection-areas';
import type { InspectorInspectionDetail } from '@/lib/crossub-api/inspector-client';
import { parseItemMarks, mergeItemMarks, stripItemMarksSummaryFromComment, type ItemConditionMarks } from '@/lib/item-condition-marks';
import {
  type InspectionExecutionDraft,
  type IngoingAreaEntryDraft,
  type IngoingExecutionDraft,
  type OutgoingAreaIssueDraft,
  type OutgoingExecutionDraft,
  type RoutineAreaIssueDraft,
  type RoutineExecutionDraft,
  type SectionBeforeAfterDraft,
  mergePhotoUrlLists,
} from '@/lib/inspection-execution-draft';
import { mergeSpecialReporting } from '@/lib/special-reporting';

const INGOING_SUFFIX = /\s*\(ingoing\)\s*$/i;
const OUTGOING_SUFFIX = /\s*\(outgoing\)\s*$/i;

function isPersistedPhotoUrl(url: string | null | undefined): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

function mergeMarks(
  base: Record<string, ItemConditionMarks> | undefined,
  overlay: Record<string, ItemConditionMarks> | undefined,
): Record<string, ItemConditionMarks> {
  const next = { ...(base ?? {}) };
  for (const [section, marks] of Object.entries(overlay ?? {})) {
    next[section] = mergeItemMarks(next[section], marks);
  }
  return next;
}

function preferSelectedAreaNames(
  saved: string[] | undefined,
  baseline: string[] | undefined,
): string[] | undefined {
  return saved !== undefined ? saved : baseline;
}

function unionNames(base: string[] | undefined, overlay: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of [...(base ?? []), ...(overlay ?? [])]) {
    const key = name.trim();
    if (!key || seen.has(key.toLowerCase())) continue;
    seen.add(key.toLowerCase());
    out.push(name);
  }
  return out;
}

function mergeComments(
  base: Record<string, string> | undefined,
  overlay: Record<string, string> | undefined,
): Record<string, string> {
  return { ...(base ?? {}), ...(overlay ?? {}) };
}

const SKIP_ITEM_NAMES = new Set(['Notes', 'Issue', 'Method']);

function itemsFromDetailArea(
  area: InspectorInspectionDetail['areas'][number],
): {
  sections: string[];
  itemMarks: Record<string, ItemConditionMarks>;
  itemComments: Record<string, string>;
  itemPhotos: Record<string, string[]>;
} {
  const sections: string[] = [];
  const itemMarks: Record<string, ItemConditionMarks> = {};
  const itemComments: Record<string, string> = {};
  const itemPhotos: Record<string, string[]> = {};
  for (const item of area.items) {
    const name = item.name?.trim();
    if (!name || SKIP_ITEM_NAMES.has(name)) continue;
    if (!sections.includes(name)) sections.push(name);
    itemMarks[name] = parseItemMarks(item.conditionTags);
    const note = stripItemMarksSummaryFromComment(item.comment, itemMarks[name]);
    if (note) itemComments[name] = note;
    const photos = item.photos.map((photo) => photo.url).filter(isPersistedPhotoUrl);
    if (photos.length > 0) itemPhotos[name] = photos;
  }
  return { sections, itemMarks, itemComments, itemPhotos };
}

function areaPhotoUrls(area: InspectorInspectionDetail['areas'][number]): string[] {
  return [
    ...area.photos.map((photo) => photo.url),
    ...area.items.flatMap((item) => item.photos.map((photo) => photo.url)),
  ].filter(isPersistedPhotoUrl);
}

function conditionFromRating(
  area: InspectorInspectionDetail['areas'][number],
): string {
  if (area.ratingRaw?.trim()) return area.ratingRaw.trim();
  if (!area.rating) return '';
  const labels: Record<string, string> = {
    EXCELLENT: 'Excellent',
    GOOD: 'Good',
    FAIR: 'Fair',
    POOR: 'Poor',
    DAMAGED: 'Damaged',
  };
  return labels[area.rating] ?? area.rating;
}

function notesFromArea(area: InspectorInspectionDetail['areas'][number]): string {
  const notes = area.items.find((item) => item.name === 'Notes');
  return notes?.comment?.trim() ?? '';
}

export function emptyIngoingEntry(
  _areaName: string,
  _customAreas: CustomAreaDefinition[] = [],
): IngoingAreaEntryDraft {
  return {
    available: null,
    condition: '',
    comments: '',
    activeSections: [],
    photosBySection: {},
    areaPhotos: [],
    itemMarks: {},
    itemComments: {},
  };
}

export function emptyRoutineIssue(_areaName: string): RoutineAreaIssueDraft {
  return {
    available: null,
    notes: '',
    activeSections: [],
    photosBySection: {},
    areaPhotos: [],
    itemMarks: {},
    itemComments: {},
  };
}

export function emptyOutgoingIssue(
  _areaName: string,
  seed?: { available: boolean | null; activeSections: string[] },
  _customAreas: CustomAreaDefinition[] = [],
): OutgoingAreaIssueDraft {
  return {
    available: seed?.available ?? null,
    note: '',
    responsibility: '',
    activeSections: seed?.activeSections ?? [],
    photosBySection: {},
    areaPhotos: [],
    itemMarks: {},
    itemComments: {},
  };
}

const emptySectionPhotos = (): SectionBeforeAfterDraft => ({
  ingoingPhotoUrls: [],
  outgoingPhotoUrls: [],
});

function mergeIngoingEntry(
  base: IngoingAreaEntryDraft,
  overlay: Partial<IngoingAreaEntryDraft> | undefined,
): IngoingAreaEntryDraft {
  if (!overlay) return base;
  const photosBySection = { ...base.photosBySection };
  for (const [section, urls] of Object.entries(overlay.photosBySection ?? {})) {
    photosBySection[section] = mergePhotoUrlLists(
      base.photosBySection[section],
      urls,
    );
  }
  return {
    available: overlay.available ?? base.available,
    condition: overlay.condition || base.condition,
    comments: overlay.comments || base.comments,
    activeSections: unionNames(base.activeSections, overlay.activeSections),
    photosBySection,
    areaPhotos: mergePhotoUrlLists(base.areaPhotos, overlay.areaPhotos),
    itemMarks: mergeMarks(base.itemMarks, overlay.itemMarks),
    itemComments: mergeComments(base.itemComments, overlay.itemComments),
  };
}

function mergeSectionPhotos(
  base: SectionBeforeAfterDraft,
  overlay: SectionBeforeAfterDraft | undefined,
): SectionBeforeAfterDraft {
  if (!overlay) return base;
  return {
    ingoingPhotoUrls: mergePhotoUrlLists(
      base.ingoingPhotoUrls,
      overlay.ingoingPhotoUrls,
    ),
    outgoingPhotoUrls: mergePhotoUrlLists(
      base.outgoingPhotoUrls,
      overlay.outgoingPhotoUrls,
    ),
  };
}

function mergeRoutineIssue(
  base: RoutineAreaIssueDraft,
  overlay: Partial<RoutineAreaIssueDraft> | undefined,
): RoutineAreaIssueDraft {
  if (!overlay) return base;
  const photosBySection = { ...base.photosBySection };
  for (const section of new Set([
    ...Object.keys(base.photosBySection),
    ...Object.keys(overlay.photosBySection ?? {}),
  ])) {
    photosBySection[section] = mergeSectionPhotos(
      base.photosBySection[section] ?? emptySectionPhotos(),
      overlay.photosBySection?.[section],
    );
  }
  return {
    available: overlay.available ?? base.available,
    notes: overlay.notes || base.notes,
    activeSections: unionNames(base.activeSections, overlay.activeSections),
    photosBySection,
    areaPhotos: mergePhotoUrlLists(base.areaPhotos, overlay.areaPhotos),
    itemMarks: mergeMarks(base.itemMarks, overlay.itemMarks),
    itemComments: mergeComments(base.itemComments, overlay.itemComments),
  };
}

function mergeOutgoingIssue(
  base: OutgoingAreaIssueDraft,
  overlay: Partial<OutgoingAreaIssueDraft> | undefined,
): OutgoingAreaIssueDraft {
  if (!overlay) return base;
  const photosBySection = { ...base.photosBySection };
  for (const section of new Set([
    ...Object.keys(base.photosBySection),
    ...Object.keys(overlay.photosBySection ?? {}),
  ])) {
    photosBySection[section] = mergeSectionPhotos(
      base.photosBySection[section] ?? emptySectionPhotos(),
      overlay.photosBySection?.[section],
    );
  }
  return {
    available: overlay.available ?? base.available,
    note: overlay.note || base.note,
    responsibility: overlay.responsibility || base.responsibility,
    activeSections: unionNames(base.activeSections, overlay.activeSections),
    photosBySection,
    areaPhotos: mergePhotoUrlLists(base.areaPhotos, overlay.areaPhotos),
    itemMarks: mergeMarks(base.itemMarks, overlay.itemMarks),
    itemComments: mergeComments(base.itemComments, overlay.itemComments),
  };
}

export function applyIngoingDetailPhotos(
  entries: Record<string, IngoingAreaEntryDraft>,
  detail: InspectorInspectionDetail,
  customAreas: CustomAreaDefinition[] = [],
): Record<string, IngoingAreaEntryDraft> {
  const next = { ...entries };

  for (const area of detail.areas) {
    const rawName = area.name?.trim() ?? '';
    const photos = areaPhotoUrls(area);
    const parsed = parseSectionAreaName(
      rawName.replace(INGOING_SUFFIX, '').replace(OUTGOING_SUFFIX, '').trim(),
    );

    if (parsed) {
      const current = next[parsed.area] ?? emptyIngoingEntry(parsed.area, customAreas);
      const photosBySection = { ...current.photosBySection };
      if (photos.length > 0) {
        photosBySection[parsed.section] = mergePhotoUrlLists(
          photosBySection[parsed.section],
          photos,
        );
      }
      next[parsed.area] = {
        ...current,
        available: current.available ?? (photos.length > 0 ? true : null),
        activeSections: photos.length
          ? [...new Set([...current.activeSections, parsed.section])]
          : current.activeSections,
        photosBySection,
      };
      continue;
    }

    const known =
      INSPECTION_AREA_CATALOG.some((def) => def.name === rawName) ||
      customAreas.some((custom) => custom.name.trim() === rawName) ||
      Boolean(next[rawName]);
    if (!known) continue;
    const current = next[rawName] ?? emptyIngoingEntry(rawName, customAreas);
    const fromItems = itemsFromDetailArea(area);
    const photosBySection = { ...current.photosBySection };
    for (const [section, urls] of Object.entries(fromItems.itemPhotos)) {
      photosBySection[section] = mergePhotoUrlLists(photosBySection[section], urls);
    }
    const areaPhotos = area.photos.map((photo) => photo.url).filter(isPersistedPhotoUrl);
    next[rawName] = {
      ...current,
      available: current.available ?? true,
      condition: current.condition || conditionFromRating(area),
      comments: current.comments || notesFromArea(area),
      activeSections:
        current.activeSections.length > 0
          ? current.activeSections
          : fromItems.sections,
      photosBySection,
      areaPhotos: mergePhotoUrlLists(current.areaPhotos, areaPhotos),
      itemMarks: mergeMarks(current.itemMarks, fromItems.itemMarks),
      itemComments: mergeComments(current.itemComments, fromItems.itemComments),
    };
  }

  return next;
}

export function applyRoutineDetailPhotos(
  issues: Record<string, RoutineAreaIssueDraft>,
  detail: InspectorInspectionDetail,
): Record<string, RoutineAreaIssueDraft> {
  const next = { ...issues };
  for (const area of detail.areas) {
    const rawName = area.name?.trim() ?? '';
    const photos = areaPhotoUrls(area);
    if (photos.length === 0) continue;

    if (INGOING_SUFFIX.test(rawName) || OUTGOING_SUFFIX.test(rawName)) {
      const stripped = rawName
        .replace(INGOING_SUFFIX, '')
        .replace(OUTGOING_SUFFIX, '')
        .trim();
      const parsed = parseSectionAreaName(stripped);
      const room = parsed?.area ?? stripped;
      if (!room) continue;

      const current = next[room] ?? emptyRoutineIssue(room);
      next[room] = {
        ...current,
        available: current.available ?? true,
        areaPhotos: mergePhotoUrlLists(current.areaPhotos, photos),
      };
      continue;
    }

    const parsed = parseSectionAreaName(rawName);
    if (parsed) {
      const current = next[parsed.area] ?? emptyRoutineIssue(parsed.area);
      next[parsed.area] = {
        ...current,
        available: current.available ?? true,
        areaPhotos: mergePhotoUrlLists(current.areaPhotos, photos),
      };
      continue;
    }

    const current = next[rawName] ?? emptyRoutineIssue(rawName);
    next[rawName] = {
      ...current,
      available: current.available ?? true,
      areaPhotos: mergePhotoUrlLists(current.areaPhotos, photos),
    };
  }
  return next;
}

export function applyOutgoingDetailPhotos(
  issues: Record<string, OutgoingAreaIssueDraft>,
  detail: InspectorInspectionDetail,
  customAreas: CustomAreaDefinition[] = [],
): Record<string, OutgoingAreaIssueDraft> {
  const next = { ...issues };

  for (const area of detail.areas) {
    const rawName = area.name?.trim() ?? '';
    const photos = areaPhotoUrls(area);
    if (photos.length === 0 && !area.items.some((item) => item.flagged)) continue;

    if (INGOING_SUFFIX.test(rawName) || OUTGOING_SUFFIX.test(rawName)) {
      const stripped = rawName
        .replace(INGOING_SUFFIX, '')
        .replace(OUTGOING_SUFFIX, '')
        .trim();
      const parsed = parseSectionAreaName(stripped);
      const room = parsed?.area ?? stripped;
      const section = parsed?.section;
      if (!room) continue;

      const current = next[room] ?? emptyOutgoingIssue(room, undefined, customAreas);
      const photosBySection = { ...current.photosBySection };
      const sectionKey = section ?? current.activeSections[0] ?? 'General';
      const sectionPhotos = photosBySection[sectionKey] ?? emptySectionPhotos();
      const key = INGOING_SUFFIX.test(rawName)
        ? 'ingoingPhotoUrls'
        : 'outgoingPhotoUrls';
      photosBySection[sectionKey] = {
        ...sectionPhotos,
        [key]: mergePhotoUrlLists(sectionPhotos[key], photos),
      };
      next[room] = {
        ...current,
        available: current.available ?? true,
        activeSections: section
          ? [...new Set([...current.activeSections, section])]
          : current.activeSections,
        photosBySection,
      };
      continue;
    }

    const parsed = parseSectionAreaName(rawName);
    if (parsed) {
      const current = next[parsed.area] ?? emptyOutgoingIssue(parsed.area, undefined, customAreas);
      const photosBySection = { ...current.photosBySection };
      const sectionPhotos = photosBySection[parsed.section] ?? emptySectionPhotos();
      photosBySection[parsed.section] = {
        ...sectionPhotos,
        outgoingPhotoUrls: mergePhotoUrlLists(sectionPhotos.outgoingPhotoUrls, photos),
      };
      next[parsed.area] = {
        ...current,
        available: current.available ?? true,
        note: current.note || notesFromArea(area),
        activeSections: [...new Set([...current.activeSections, parsed.section])],
        photosBySection,
      };
      continue;
    }

    const known =
      INSPECTION_AREA_CATALOG.some((def) => def.name === rawName) ||
      customAreas.some((custom) => custom.name.trim() === rawName) ||
      Boolean(next[rawName]);
    if (!known) continue;
    const current = next[rawName] ?? emptyOutgoingIssue(rawName, undefined, customAreas);
    const issueItem = area.items.find((item) => item.name === 'Issue');
    next[rawName] = {
      ...current,
      available: current.available ?? true,
      note: current.note || issueItem?.comment?.trim() || notesFromArea(area),
      responsibility:
        current.responsibility ||
        issueItem?.conditionTags?.[0]?.trim() ||
        '',
    };
  }

  return next;
}

export function mergeIngoingExecutionDraft(
  baseline: IngoingExecutionDraft,
  saved: Partial<IngoingExecutionDraft> | null | undefined,
): IngoingExecutionDraft {
  if (!saved) return baseline;
  const customAreas = saved.customAreas ?? baseline.customAreas ?? [];
  const selectedAreaNames = preferSelectedAreaNames(
    saved.selectedAreaNames,
    baseline.selectedAreaNames,
  );
  const names = new Set([
    ...(selectedAreaNames ?? []),
    ...Object.keys(baseline.entries),
    ...Object.keys(saved.entries ?? {}),
  ]);
  const entries: Record<string, IngoingAreaEntryDraft> = {};
  for (const name of names) {
    entries[name] = mergeIngoingEntry(
      baseline.entries[name] ?? emptyIngoingEntry(name, customAreas),
      saved.entries?.[name],
    );
  }
  return {
    kind: 'ingoing',
    areaIndex:
      typeof saved.areaIndex === 'number' ? saved.areaIndex : baseline.areaIndex,
    entries,
    customAreas,
    selectedAreaNames,
    areaSetupComplete: saved.areaSetupComplete ?? baseline.areaSetupComplete,
    specialReporting: mergeSpecialReporting(
      saved.specialReporting ?? baseline.specialReporting,
    ),
    workflowStep: saved.workflowStep ?? baseline.workflowStep,
  };
}

export function mergeRoutineExecutionDraft(
  baseline: RoutineExecutionDraft,
  saved: Partial<RoutineExecutionDraft> | null | undefined,
): RoutineExecutionDraft {
  if (!saved) return baseline;
  const selectedAreaNames = preferSelectedAreaNames(
    saved.selectedAreaNames,
    baseline.selectedAreaNames,
  );
  const names = new Set([
    ...(selectedAreaNames ?? []),
    ...Object.keys(baseline.issues),
    ...Object.keys(saved.issues ?? {}),
  ]);
  const issues: Record<string, RoutineAreaIssueDraft> = {};
  for (const name of names) {
    issues[name] = mergeRoutineIssue(
      baseline.issues[name] ?? emptyRoutineIssue(name),
      saved.issues?.[name],
    );
  }
  return {
    kind: 'routine',
    areaIndex:
      typeof saved.areaIndex === 'number' ? saved.areaIndex : baseline.areaIndex,
    method: saved.method ?? baseline.method,
    issues,
    customAreas: saved.customAreas ?? baseline.customAreas,
    selectedAreaNames,
    areaSetupComplete: saved.areaSetupComplete ?? baseline.areaSetupComplete,
  };
}

export function mergeDeviceExecutionDrafts<T extends InspectionExecutionDraft>(
  kind: T['kind'],
  baseline: T,
  overlays: Array<{ kind: string; updatedAt?: string; draft: unknown }>,
  merge: (base: T, overlay: Partial<T> | null | undefined) => T,
): T {
  const sorted = overlays
    .filter((overlay) => overlay.kind === kind && overlay.draft && typeof overlay.draft === 'object')
    .sort((a, b) => (a.updatedAt ?? '').localeCompare(b.updatedAt ?? ''));
  return sorted.reduce((current, overlay) => {
    const overlayTime = overlay.updatedAt ?? '';
    const currentTime = current.updatedAt ?? '';
    if (overlayTime && currentTime && overlayTime < currentTime) {
      return current;
    }
    const merged = merge(current, overlay.draft as Partial<T>);
    return {
      ...merged,
      updatedAt:
        overlayTime && (!currentTime || overlayTime >= currentTime)
          ? overlay.updatedAt
          : current.updatedAt,
    };
  }, baseline);
}

export function mergeOutgoingExecutionDraft(
  baseline: OutgoingExecutionDraft,
  saved: Partial<OutgoingExecutionDraft> | null | undefined,
): OutgoingExecutionDraft {
  if (!saved) return baseline;
  const customAreas = saved.customAreas ?? baseline.customAreas ?? [];
  const selectedAreaNames = preferSelectedAreaNames(
    saved.selectedAreaNames,
    baseline.selectedAreaNames,
  );
  const names = new Set([
    ...(selectedAreaNames ?? []),
    ...Object.keys(baseline.issues),
    ...Object.keys(saved.issues ?? {}),
  ]);
  const issues: Record<string, OutgoingAreaIssueDraft> = {};
  for (const name of names) {
    issues[name] = mergeOutgoingIssue(
      baseline.issues[name] ?? emptyOutgoingIssue(name, undefined, customAreas),
      saved.issues?.[name],
    );
  }
  return {
    kind: 'outgoing',
    areaIndex:
      typeof saved.areaIndex === 'number' ? saved.areaIndex : baseline.areaIndex,
    issues,
    customAreas,
    selectedAreaNames,
    areaSetupComplete: saved.areaSetupComplete ?? baseline.areaSetupComplete,
    specialReporting: mergeSpecialReporting(
      saved.specialReporting ?? baseline.specialReporting,
    ),
  };
}
