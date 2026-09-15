import type { InspectorInspectionDetail } from '@/src/api/inspector';

export type FindingsRoom = {
  area: string;
  condition: string;
  comments: string;
  photoUrls: string[];
  ingoingPhotoUrls?: string[];
  outgoingPhotoUrls?: string[];
};

const CONDITION_LABEL: Record<string, string> = {
  CLEAN_TIDY: 'Clean & Tidy',
  GOOD: 'Good',
  ABOVE_SATISFACTORY: 'Above Satisfactory',
  SATISFACTORY: 'Satisfactory',
  FAIR: 'Fair',
  AS_INDICATED: 'As Indicated',
  MESSY: 'Messy',
  POOR: 'Poor',
  UNRATED: 'Unrated',
};

const INGOING_AREA_SUFFIX = / \(Ingoing\)$/;
const OUTGOING_AREA_SUFFIX = / \(Outgoing\)$/;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isPersistedPhotoUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

function conditionLabel(rating: string): string {
  return CONDITION_LABEL[rating] ?? rating;
}

function areaComments(area: InspectorInspectionDetail['areas'][number]): string {
  return area.items
    .map((item) => {
      const name = asString(item.name);
      const tags = (item.conditionTags ?? []).filter((tag) => tag.trim().length > 0);
      const detail = asString(item.comment) || tags.join(' · ');
      if (!detail) return null;
      if (name && name.toLowerCase() !== 'notes' && name.toLowerCase() !== 'issue') {
        return `${name}: ${detail}`;
      }
      return detail;
    })
    .filter((comment): comment is string => Boolean(comment))
    .join(' · ');
}

function areaPhotoUrls(area: InspectorInspectionDetail['areas'][number]): string[] {
  return [
    ...area.photos.map((photo) => photo.url),
    ...area.items.flatMap((item) => item.photos.map((photo) => photo.url)),
  ].filter(isPersistedPhotoUrl);
}

function mapSingleArea(area: InspectorInspectionDetail['areas'][number]): FindingsRoom {
  const photoUrls = areaPhotoUrls(area);
  return {
    area: asString(area.name) ?? 'Unnamed area',
    condition: asString(area.ratingRaw) ?? conditionLabel(area.rating),
    comments: areaComments(area),
    photoUrls,
  };
}

function mapOutgoingInspectionDetail(dto: InspectorInspectionDetail): FindingsRoom[] {
  type Bucket = {
    ingoingPhotoUrls: string[];
    outgoingPhotoUrls: string[];
    comments: string;
  };

  const grouped = new Map<string, Bucket>();
  const bucketFor = (room: string): Bucket =>
    grouped.get(room) ?? { ingoingPhotoUrls: [], outgoingPhotoUrls: [], comments: '' };

  for (const area of dto.areas) {
    const name = asString(area.name) ?? '';
    const photos = areaPhotoUrls(area);
    const comments = areaComments(area);

    if (INGOING_AREA_SUFFIX.test(name)) {
      const room = name.replace(INGOING_AREA_SUFFIX, '');
      const bucket = bucketFor(room);
      bucket.ingoingPhotoUrls.push(...photos);
      grouped.set(room, bucket);
      continue;
    }

    if (OUTGOING_AREA_SUFFIX.test(name)) {
      const room = name.replace(OUTGOING_AREA_SUFFIX, '');
      const bucket = bucketFor(room);
      bucket.outgoingPhotoUrls.push(...photos);
      if (comments) bucket.comments = comments;
      grouped.set(room, bucket);
      continue;
    }

    const bucket = bucketFor(name);
    if (comments) bucket.comments = comments;
    if (photos.length > 0) bucket.outgoingPhotoUrls.push(...photos);
    grouped.set(name, bucket);
  }

  return [...grouped.entries()]
    .map(([area, bucket]) => ({
      area,
      condition: '',
      comments: bucket.comments,
      photoUrls: [...bucket.ingoingPhotoUrls, ...bucket.outgoingPhotoUrls],
      ingoingPhotoUrls: bucket.ingoingPhotoUrls,
      outgoingPhotoUrls: bucket.outgoingPhotoUrls,
    }))
    .filter(
      (row) =>
        row.ingoingPhotoUrls.length > 0 ||
        row.outgoingPhotoUrls.length > 0 ||
        Boolean(row.comments),
    );
}

export function mapInspectionDetail(dto: InspectorInspectionDetail): FindingsRoom[] {
  const hasOutgoingStyle = dto.areas.some((area) => {
    const name = asString(area.name) ?? '';
    return INGOING_AREA_SUFFIX.test(name) || OUTGOING_AREA_SUFFIX.test(name);
  });
  if (hasOutgoingStyle) return mapOutgoingInspectionDetail(dto);
  return dto.areas
    .map(mapSingleArea)
    .filter(
      (row) =>
        row.photoUrls.length > 0 ||
        Boolean(row.comments) ||
        (row.condition && row.condition !== 'Unrated'),
    );
}
