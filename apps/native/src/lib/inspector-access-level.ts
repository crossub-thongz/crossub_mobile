import type { CoreInspectionType } from '@/src/constants/inspection';

export const INSPECTOR_ACCESS_LEVELS = [1, 2, 3, 4, 5] as const;
export type InspectorAccessLevel = (typeof INSPECTOR_ACCESS_LEVELS)[number];

export const INSPECTOR_ACCESS_LEVEL_DEFAULT: InspectorAccessLevel = 1;

export function normalizeInspectorAccessLevel(value: unknown): InspectorAccessLevel {
  const n = Number(value);
  return INSPECTOR_ACCESS_LEVELS.includes(n as InspectorAccessLevel)
    ? (n as InspectorAccessLevel)
    : INSPECTOR_ACCESS_LEVEL_DEFAULT;
}

export function inspectorLevelAllows(
  level: number,
  capability: 'routine' | 'open' | 'tribunal',
): boolean {
  const access = normalizeInspectorAccessLevel(level);
  if (capability === 'routine') return access === 2 || access >= 4;
  if (capability === 'open') return access >= 3;
  return access === 5;
}

export function poolTypesForInspectorLevel(level: number): CoreInspectionType[] {
  const types: CoreInspectionType[] = ['ingoing', 'outgoing'];
  if (inspectorLevelAllows(level, 'routine')) types.push('routine');
  if (inspectorLevelAllows(level, 'open')) types.push('open');
  return types;
}
