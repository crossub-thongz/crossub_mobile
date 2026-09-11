import type { SaveInspectorFindings } from '@/src/api/inspector';
import type { RoutineAreaIssueDraft } from '@/src/lib/types';

export function findingsAreaFromRoom(
  name: string,
  rec: RoutineAreaIssueDraft | undefined,
): SaveInspectorFindings['areas'][number] {
  const notes = rec?.notes?.trim();
  return {
    name,
    rating: 'Good',
    items: notes ? [{ name: 'Notes', comment: notes, flagged: false }] : [],
  };
}

export function routineFindingsPayload(
  method: 'physical' | 'self',
  areaNames: string[],
  issues: Record<string, RoutineAreaIssueDraft>,
): SaveInspectorFindings {
  const rooms = areaNames
    .filter((name) => issues[name]?.available === true)
    .map((name) => findingsAreaFromRoom(name, issues[name]));
  return {
    areas: [
      {
        name: 'General',
        rating: 'Good',
        items: [
          {
            name: 'Method',
            comment:
              method === 'physical'
                ? 'Physical inspection'
                : 'Tenant self-assessment review',
            flagged: false,
          },
        ],
      },
      ...rooms,
    ],
  };
}

export function attendanceWindowFromHours(estimatedHours: number): {
  startTime: string;
  endTime: string;
} {
  const end = new Date();
  const hours = Number.isFinite(estimatedHours) && estimatedHours > 0 ? estimatedHours : 1;
  const start = new Date(end.getTime() - hours * 3_600_000);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}
