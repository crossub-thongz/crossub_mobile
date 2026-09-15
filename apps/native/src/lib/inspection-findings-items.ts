import type { SaveInspectorFindings } from '@/src/api/inspector';
import {
  areaRatingFromMarks,
  itemReportComment,
  marksHaveNo,
  serializeItemMarks,
  type ItemConditionMarks,
} from '@/src/lib/item-condition-marks';

type FindingsArea = SaveInspectorFindings['areas'][number];
type FindingsItem = NonNullable<FindingsArea['items']>[number];

export function findingsItemsFromSections(input: {
  sections: readonly string[];
  marksBySection?: Record<string, ItemConditionMarks>;
  commentsBySection?: Record<string, string>;
  notes?: string;
}): FindingsItem[] {
  const items: FindingsItem[] = [];
  if (input.notes?.trim()) {
    items.push({ name: 'Notes', comment: input.notes.trim() });
  }
  for (const section of input.sections) {
    const marks = input.marksBySection?.[section];
    items.push({
      name: section,
      comment: itemReportComment(marks, input.commentsBySection?.[section]),
      flagged: marksHaveNo(marks),
      conditionTags: serializeItemMarks(marks),
    });
  }
  return items;
}

export function findingsAreaFromSections(input: {
  name: string;
  sections: readonly string[];
  marksBySection?: Record<string, ItemConditionMarks>;
  commentsBySection?: Record<string, string>;
  notes?: string;
  rating?: FindingsArea['rating'];
}): FindingsArea {
  return {
    name: input.name,
    rating: input.rating ?? areaRatingFromMarks(input.sections, input.marksBySection),
    items: findingsItemsFromSections(input),
  };
}
