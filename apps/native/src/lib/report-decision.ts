export type ReportDecision = 'approved' | 'declined';

export function reportDecisionOf(item: {
  title: string;
  body: string;
}): ReportDecision | null {
  const text = `${item.title} ${item.body}`.toLowerCase();
  if (text.includes('report declined') || text.includes('was declined')) {
    return 'declined';
  }
  if (text.includes('report approved') || text.includes('was approved')) {
    return 'approved';
  }
  return null;
}
