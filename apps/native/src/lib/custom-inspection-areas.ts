import {
  COMMON_DEFAULT_SECTIONS,
  INSPECTION_AREA_CATALOG,
  getInspectionAreaDefinition,
  type InspectionAreaDefinition,
} from '@/src/constants/inspection-areas';

export type CustomAreaSectionMode = 'standard' | 'manual';

export type CustomAreaDefinition = {
  name: string;
  sectionMode: CustomAreaSectionMode;
  defaultSections?: string[];
  optionalSections?: string[];
};

export function customAreaToDefinition(custom: CustomAreaDefinition): InspectionAreaDefinition {
  const catalog = getInspectionAreaDefinition(custom.name);
  const standardDefaults = catalog ? [...catalog.defaultSections] : [...COMMON_DEFAULT_SECTIONS];
  const standardOptional = catalog ? [...catalog.optionalSections] : ['Custom / Other'];

  if (custom.defaultSections || custom.optionalSections) {
    return {
      name: custom.name,
      defaultSections:
        custom.defaultSections && custom.defaultSections.length > 0
          ? [...custom.defaultSections]
          : custom.sectionMode === 'standard'
            ? standardDefaults
            : [],
      optionalSections: custom.optionalSections?.length ? [...custom.optionalSections] : standardOptional,
    };
  }
  if (custom.sectionMode === 'standard') {
    return {
      name: custom.name,
      defaultSections: standardDefaults,
      optionalSections: standardOptional,
    };
  }
  return {
    name: custom.name,
    defaultSections: [],
    optionalSections: [...COMMON_DEFAULT_SECTIONS, 'Custom / Other'],
  };
}

export function resolveAreaDefinition(
  areaName: string,
  customAreas: CustomAreaDefinition[] = [],
): InspectionAreaDefinition {
  const custom = customAreas.find(
    (area) => area.name.trim().toLowerCase() === areaName.trim().toLowerCase(),
  );
  if (custom?.defaultSections?.length || custom?.optionalSections?.length) {
    return customAreaToDefinition(custom);
  }
  const builtIn = getInspectionAreaDefinition(areaName);
  if (builtIn) return builtIn;
  if (custom) return customAreaToDefinition(custom);
  return {
    name: areaName,
    defaultSections: [],
    optionalSections: [...COMMON_DEFAULT_SECTIONS, 'Custom / Other'],
  };
}

export function normalizeCustomAreaName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function classifyAddedAreaName(name: string): { kind: 'catalog' | 'custom'; name: string } {
  const normalized = normalizeCustomAreaName(name);
  const catalog = INSPECTION_AREA_CATALOG.find(
    (area) => area.name.toLowerCase() === normalized.toLowerCase(),
  );
  if (catalog) return { kind: 'catalog', name: catalog.name };
  return { kind: 'custom', name: normalized };
}

export function validateNewCustomAreaName(name: string, takenNames: readonly string[] = []): string | null {
  const normalized = normalizeCustomAreaName(name);
  if (normalized.length < 2) return 'Enter an area name (at least 2 characters).';
  const key = normalized.toLowerCase();
  if (takenNames.some((item) => item.trim().toLowerCase() === key)) {
    return 'An area with this name already exists.';
  }
  return null;
}

export function appendSelectedAreaName(
  selected: string[] | undefined,
  name: string,
): string[] {
  const current = selected ?? [];
  const key = name.trim().toLowerCase();
  if (current.some((item) => item.trim().toLowerCase() === key)) return current;
  return [...current, name];
}

export function removeSelectedAreaName(selected: string[] | undefined, name: string): string[] {
  const key = name.trim().toLowerCase();
  return (selected ?? []).filter((item) => item.trim().toLowerCase() !== key);
}

export function omitNamedRecordKey<T>(record: Record<string, T>, name: string): Record<string, T> {
  const key = name.trim().toLowerCase();
  const next = { ...record };
  for (const existing of Object.keys(next)) {
    if (existing.trim().toLowerCase() === key) delete next[existing];
  }
  return next;
}
