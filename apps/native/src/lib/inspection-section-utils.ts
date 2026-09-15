import { COMMON_DEFAULT_SECTIONS, type InspectionAreaDefinition } from '@/src/constants/inspection-areas';

const CUSTOM_OTHER_LABEL = 'Custom / Other';

export function buildSectionPickerOptions(
  definition: Pick<InspectionAreaDefinition, 'optionalSections'>,
): string[] {
  const merged = new Set<string>([...definition.optionalSections, ...COMMON_DEFAULT_SECTIONS]);
  merged.delete(CUSTOM_OTHER_LABEL);
  return [...merged];
}

export function normalizeSectionName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateNewSectionName(name: string, activeSections: readonly string[]): string | null {
  const normalized = normalizeSectionName(name);
  if (normalized.length < 2) return 'Enter a section name (at least 2 characters).';
  const key = normalized.toLowerCase();
  if (activeSections.some((section) => section.trim().toLowerCase() === key)) {
    return 'This section is already added.';
  }
  return null;
}
