import { ONE_BED_AREAS } from '@/src/constants/inspection';
import type { InspectorInspectionDetail } from '@/src/api/inspector';
import { resolveAreaDefinition, type CustomAreaDefinition } from '@/src/lib/custom-inspection-areas';
import type { PropertyInspectionSpec, RoutineAreaIssueDraft } from '@/src/lib/types';

export function areasFromBedroomCount(bedrooms: number | null | undefined): string[] {
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

export function layoutTemplateFromProperty(spec: PropertyInspectionSpec): string[] {
  return areasFromBedroomCount(spec.bedrooms);
}

export function roomsFromIngoingDetail(detail: InspectorInspectionDetail): string[] {
  const planRooms = detail.referenceIngoing?.areaPlan?.rooms ?? [];
  if (planRooms.length > 0) {
    return planRooms.map((room) => room.name.trim()).filter(Boolean);
  }
  const names = (detail.referenceIngoing?.areas ?? [])
    .map((area) => area.name.replace(/\s*\(ingoing\)\s*$/i, '').trim())
    .filter(Boolean);
  return [...new Set(names)];
}

export function draftNeedsLayoutSeed(draft: {
  areaSetupComplete?: boolean;
  selectedAreaNames?: string[];
}): boolean {
  if (draft.areaSetupComplete === true) return false;
  return draft.selectedAreaNames == null;
}

export function emptyRoutineIssue(): RoutineAreaIssueDraft {
  return { available: null, notes: '', areaPhotos: [] };
}

export function seedAreasForStart(
  record: Record<string, RoutineAreaIssueDraft>,
  areaNames: string[],
  customAreas: CustomAreaDefinition[] = [],
): Record<string, RoutineAreaIssueDraft> {
  const next = { ...record };
  for (const name of areaNames) {
    const current = next[name] ?? emptyRoutineIssue();
    if (current.available === false) {
      next[name] = current;
      continue;
    }
    const definition = resolveAreaDefinition(name, customAreas);
    const sections =
      current.activeSections && current.activeSections.length > 0
        ? current.activeSections
        : [...definition.defaultSections];
    next[name] = { ...current, available: true, activeSections: sections };
  }
  return next;
}
