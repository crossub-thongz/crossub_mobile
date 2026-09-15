import { parseSectionAreaName, sectionAreaName } from '@/src/constants/inspection-areas';
import type { RoutineAreaIssueDraft } from '@/src/lib/types';

const INGOING_SUFFIX = /\s*\(ingoing\)\s*$/i;
const OUTGOING_SUFFIX = /\s*\(outgoing\)\s*$/i;

export type ReferenceArea = { name: string; photos?: Array<{ url?: string | null }> };

function normalizeAreaKey(name: string): string {
  return name
    .replace(INGOING_SUFFIX, '')
    .replace(OUTGOING_SUFFIX, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function photoUrls(area: ReferenceArea | undefined): string[] {
  return (area?.photos ?? []).map((photo) => photo.url).filter((url): url is string => Boolean(url));
}

export function matchReferenceIngoingPhotos(
  roomName: string,
  referenceAreas: ReferenceArea[],
): string[] {
  const target = normalizeAreaKey(roomName);
  if (!target) return [];

  const exact = referenceAreas.find((area) => normalizeAreaKey(area.name) === target);
  if (exact) return photoUrls(exact);

  const startsWith = referenceAreas.find((area) => {
    const key = normalizeAreaKey(area.name);
    return key.startsWith(target) || target.startsWith(key);
  });
  if (startsWith) return photoUrls(startsWith);

  const contains = referenceAreas.find((area) => {
    const key = normalizeAreaKey(area.name);
    return key.includes(target) || target.includes(key);
  });
  return photoUrls(contains);
}

export function matchReferenceSectionPhotos(
  roomName: string,
  section: string,
  referenceAreas: ReferenceArea[],
): string[] {
  const sectionTarget = normalizeAreaKey(sectionAreaName(roomName, section));
  const exactSection = referenceAreas.find(
    (area) => normalizeAreaKey(area.name) === sectionTarget,
  );
  if (exactSection) return photoUrls(exactSection);

  for (const area of referenceAreas) {
    const parsed = parseSectionAreaName(area.name.replace(INGOING_SUFFIX, '').trim());
    if (!parsed) continue;
    if (
      normalizeAreaKey(parsed.area) === normalizeAreaKey(roomName) &&
      normalizeAreaKey(parsed.section) === normalizeAreaKey(section)
    ) {
      return photoUrls(area);
    }
  }

  return matchReferenceIngoingPhotos(roomName, referenceAreas);
}

export function referenceIngoingHasPhotos(referenceAreas: ReferenceArea[]): boolean {
  return referenceAreas.some((area) => photoUrls(area).length > 0);
}

export function seedOutgoingReferencePhotos(
  issues: Record<string, RoutineAreaIssueDraft>,
  areaNames: string[],
  referenceAreas: ReferenceArea[],
): Record<string, RoutineAreaIssueDraft> {
  if (referenceAreas.length === 0) return issues;
  const next = { ...issues };
  for (const areaName of areaNames) {
    const existing = next[areaName];
    const sections = existing?.activeSections ?? [];
    if (sections.length === 0) continue;
    const photosBySection = { ...(existing?.photosBySection ?? {}) };
    let areaSeeded = false;
    for (const section of sections) {
      const current = photosBySection[section];
      if ((current?.ingoingPhotoUrls.length ?? 0) > 0) continue;
      const referenceUrls = matchReferenceSectionPhotos(areaName, section, referenceAreas);
      if (referenceUrls.length === 0) continue;
      photosBySection[section] = {
        ingoingPhotoUrls: referenceUrls,
        outgoingPhotoUrls: current?.outgoingPhotoUrls ?? [],
      };
      areaSeeded = true;
    }
    if (areaSeeded && existing) {
      next[areaName] = { ...existing, photosBySection };
    }
  }
  return next;
}
