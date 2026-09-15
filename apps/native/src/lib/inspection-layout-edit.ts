import { resolveAreaDefinition, type CustomAreaDefinition } from '@/src/lib/custom-inspection-areas';

export function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function rekeyRecord<T>(record: Record<string, T>, oldKey: string, newKey: string): Record<string, T> {
  if (oldKey === newKey || !(oldKey in record)) return record;
  const { [oldKey]: value, ...rest } = record;
  return { ...rest, [newKey]: value };
}

export function validateUniqueLabel(
  name: string,
  taken: readonly string[],
  exclude?: string,
): string | null {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2) return 'Enter a name (at least 2 characters).';
  const key = normalized.toLowerCase();
  if (taken.some((item) => item !== exclude && item.trim().toLowerCase() === key)) {
    return 'That name is already in the list.';
  }
  return null;
}

export function renameCustomArea(
  customAreas: CustomAreaDefinition[],
  oldName: string,
  newName: string,
): CustomAreaDefinition[] {
  const def = resolveAreaDefinition(oldName, customAreas);
  const without = customAreas.filter((area) => area.name !== oldName);
  return [
    ...without,
    {
      name: newName,
      sectionMode: def.defaultSections.length > 0 ? 'standard' : 'manual',
      defaultSections: [...def.defaultSections],
      optionalSections: [...def.optionalSections],
    },
  ];
}
