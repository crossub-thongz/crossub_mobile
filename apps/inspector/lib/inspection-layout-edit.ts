import {
  effectiveSelectedAreaNames,
  omitNamedRecordKey,
  removeSelectedAreaName,
  resolveAreaDefinition,
  type CustomAreaDefinition,
} from '@/lib/custom-inspection-areas';

export function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= list.length ||
    to >= list.length
  ) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function rekeyRecord<T>(
  record: Record<string, T>,
  oldKey: string,
  newKey: string,
): Record<string, T> {
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
  if (normalized.length < 2) {
    return 'Enter a name (at least 2 characters).';
  }
  const key = normalized.toLowerCase();
  if (
    taken.some(
      (item) =>
        item !== exclude && item.trim().toLowerCase() === key,
    )
  ) {
    return 'That name is already in the list.';
  }
  return null;
}

type AreaSetupShape = {
  selectedAreaNames?: string[];
  customAreas?: CustomAreaDefinition[];
  areaIndex: number;
};

/** Shared room-list edits for ingoing (`entries`), outgoing, and routine (`issues`). */
export function removeSetupArea<T extends AreaSetupShape, R>(
  prev: T,
  name: string,
  records: Record<string, R>,
): T & { records: Record<string, R> } {
  const nextSelected = removeSelectedAreaName(
    prev.selectedAreaNames,
    name,
    records,
    prev.customAreas ?? [],
  );
  const nextCustom = (prev.customAreas ?? []).filter(
    (item) => item.name.trim().toLowerCase() !== name.trim().toLowerCase(),
  );
  return {
    ...prev,
    selectedAreaNames: nextSelected,
    customAreas: nextCustom,
    records: omitNamedRecordKey(records, name),
    areaIndex: Math.min(prev.areaIndex, Math.max(nextSelected.length - 1, 0)),
  };
}

export function moveSetupArea<T extends AreaSetupShape, R>(
  prev: T,
  from: number,
  to: number,
  records: Record<string, R>,
): T {
  return {
    ...prev,
    selectedAreaNames: moveIndex(
      effectiveSelectedAreaNames(prev.selectedAreaNames, records, prev.customAreas ?? []),
      from,
      to,
    ),
  };
}

export function renameSetupArea<T extends AreaSetupShape, R>(
  prev: T,
  from: string,
  to: string,
  records: Record<string, R>,
): T & { records: Record<string, R> } {
  if (from === to) return { ...prev, records };
  return {
    ...prev,
    selectedAreaNames: (prev.selectedAreaNames ?? []).map((name) =>
      name === from ? to : name,
    ),
    customAreas: renameCustomArea(prev.customAreas ?? [], from, to),
    records: rekeyRecord(records, from, to),
  };
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
