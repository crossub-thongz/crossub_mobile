import { catalogAreaNameFor, INSPECTION_AREA_CATALOG } from '@/constants/inspection-areas';
import type { CustomAreaDefinition } from '@/lib/custom-inspection-areas';
import type { IngoingAreaPlan } from '@/lib/ingoing-area-plan';
import type { PropertyInspectionSpec } from '@/lib/types';

export type InspectionLayout = {
  names: string[];
  customAreas: CustomAreaDefinition[];
};

const ONE_BED_AREAS = [
  'Lounge Room',
  'Dining Room',
  'Kitchen',
  'Laundry',
  'Bathroom',
  'Bedroom 1',
] as const;

/**
 * Room list from property bedroom count (bathrooms / parking are ignored).
 *
 * - 1B: Lounge, Dining, Kitchen, Laundry, Bathroom, Bedroom 1
 * - 2B: + Ensuite under Bedroom 1, Bedroom 2
 * - 3B: + Bedroom 3
 * - 4B / 5B+: + Bedroom 4, Bathroom 2
 */
export function areasFromBedroomCount(
  bedrooms: number | null | undefined,
): string[] {
  const count = Number.isFinite(bedrooms) ? Math.floor(Number(bedrooms)) : 1;
  const names: string[] = [...ONE_BED_AREAS];
  if (count <= 1) return names;

  names.push('Ensuite', 'Bedroom 2');
  if (count === 2) return names;

  names.push('Bedroom 3');
  if (count === 3) return names;

  names.push('Bedroom 4', 'Bathroom 2');
  return names;
}

export function customAreasForRoomNames(
  names: string[],
): CustomAreaDefinition[] {
  const catalog = new Set(
    INSPECTION_AREA_CATALOG.map((area) => area.name.toLowerCase()),
  );
  const seen = new Set<string>();
  const custom: CustomAreaDefinition[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (catalog.has(key) || catalogAreaNameFor(trimmed) || seen.has(key)) continue;
    seen.add(key);
    custom.push({ name: trimmed, sectionMode: 'standard' });
  }
  return custom;
}

export function mergeCustomAreas(
  existing: CustomAreaDefinition[] = [],
  extras: CustomAreaDefinition[] = [],
): CustomAreaDefinition[] {
  const next = [...existing];
  const indexByKey = new Map(
    next.map((area, index) => [area.name.trim().toLowerCase(), index] as const),
  );
  for (const extra of extras) {
    const key = extra.name.trim().toLowerCase();
    if (!key) continue;
    const index = indexByKey.get(key);
    if (index == null) {
      indexByKey.set(key, next.length);
      next.push(extra);
      continue;
    }
    if (extra.defaultSections?.length || extra.optionalSections?.length) {
      next[index] = {
        ...next[index],
        ...extra,
        name: extra.name.trim() || next[index].name,
      };
    }
  }
  return next;
}

function sameLayout(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (name, index) =>
      name.trim().toLowerCase() === b[index].trim().toLowerCase(),
  );
}

/** Previous house/apartment seed (Entry + Living Room + Balcony / Exterior). */
export function isLegacyGeneratedLayout(names: string[]): boolean {
  const lower = names.map((name) => name.trim().toLowerCase());
  if (lower[0] !== 'entry') return false;
  return (
    lower.includes('living room') &&
    (lower.includes('balcony') || lower.includes('general & exterior'))
  );
}

/**
 * Default room layout from the property bedroom count — same templates as
 * tenant self-routine.
 */
export function layoutTemplateFromProperty(
  spec: PropertyInspectionSpec,
): InspectionLayout {
  const unique = areasFromBedroomCount(spec.bedrooms);
  return { names: unique, customAreas: customAreasForRoomNames(unique) };
}

/** Copy & merge: outgoing / routine inherit the last ingoing rooms and items. */
export function layoutFromIngoingPlan(
  plan: IngoingAreaPlan | null | undefined,
  options?: { includeSections?: boolean },
): InspectionLayout | null {
  if (!plan?.rooms.length) return null;
  const includeSections = options?.includeSections !== false;
  const names: string[] = [];
  const customAreas: CustomAreaDefinition[] = [];
  for (const room of plan.rooms) {
    const name = room.name.trim();
    if (!name) continue;
    names.push(name);
    customAreas.push(
      includeSections
        ? {
            name,
            sectionMode: room.sections.length > 0 ? 'standard' : 'manual',
            defaultSections: [...room.sections],
            optionalSections: ['Custom / Other'],
          }
        : {
            name,
            sectionMode: 'manual',
            defaultSections: [],
            optionalSections: [],
          },
    );
  }
  if (names.length === 0) return null;
  return { names, customAreas };
}

export function draftNeedsLayoutSeed(
  draft: {
    areaSetupComplete?: boolean;
    selectedAreaNames?: string[];
  },
  templateNames?: string[],
): boolean {
  if (draft.areaSetupComplete === true) return false;
  // undefined = never seeded. [] = inspector deleted every room — do not bounce
  // the bedroom template back.
  if (draft.selectedAreaNames == null) return true;
  const selected = draft.selectedAreaNames;
  if (selected.length === 0) return false;
  if (templateNames && sameLayout(selected, templateNames)) return false;
  return isLegacyGeneratedLayout(selected);
}
