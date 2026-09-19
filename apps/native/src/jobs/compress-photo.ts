import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { UploadInspectorPhoto } from '@/src/api/inspector';

/** Longest edge for inspection evidence. Smaller than full camera stills so 1500+ photos stay safe. */
export const INSPECTION_PHOTO_MAX_EDGE = 1280;
/** Target decoded JPEG size (~450 KB). Nest allows 25 MB; this is a device-memory budget. */
export const INSPECTION_PHOTO_MAX_BYTES = 450_000;
export const INSPECTION_BURST_MAX = 80;

const START_QUALITY = 0.62;
const MIN_QUALITY = 0.4;
const MIN_EDGE = 640;

export type LocalPhoto = {
  uri: string;
  width: number;
  height: number;
};

export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export async function deleteLocalPhoto(uri: string | undefined): Promise<void> {
  if (!uri || !uri.startsWith('file:')) return;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Cache file may already have been reclaimed.
  }
}

async function fileSize(uri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && 'size' in info && typeof info.size === 'number') return info.size;
  } catch {
    // Missing file is treated as unknown size.
  }
  return 0;
}

function resizeActions(
  width: number,
  height: number,
  edge: number,
): { resize: { width: number } }[] | { resize: { height: number } }[] | [] {
  if (width <= 0 || height <= 0) return [];
  if (width <= edge && height <= edge) return [];
  return width >= height ? [{ resize: { width: edge } }] : [{ resize: { height: edge } }];
}

/**
 * Resize and JPEG-encode to a cache file. Never returns base64.
 * Drops the original capture file when a smaller copy is written.
 */
export async function compressPhotoToFile(photo: LocalPhoto): Promise<LocalPhoto> {
  const existing = await fileSize(photo.uri);
  const withinEdge =
    photo.width > 0 &&
    photo.height > 0 &&
    photo.width <= INSPECTION_PHOTO_MAX_EDGE &&
    photo.height <= INSPECTION_PHOTO_MAX_EDGE;
  if (existing > 0 && existing <= INSPECTION_PHOTO_MAX_BYTES && withinEdge) {
    return photo;
  }

  let source = photo.uri;
  let width = photo.width;
  let height = photo.height;
  let quality = START_QUALITY;
  let edge = INSPECTION_PHOTO_MAX_EDGE;
  let current = photo.uri;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await manipulateAsync(current, resizeActions(width, height, edge), {
      compress: quality,
      format: SaveFormat.JPEG,
    });
    if (result.uri !== current && current !== source) {
      await deleteLocalPhoto(current);
    }
    current = result.uri;
    width = result.width;
    height = result.height;
    const size = await fileSize(current);
    if (size > 0 && size <= INSPECTION_PHOTO_MAX_BYTES) break;
    if (quality > MIN_QUALITY + 0.01) {
      quality = Math.max(MIN_QUALITY, quality - 0.12);
    } else {
      edge = Math.max(MIN_EDGE, Math.round(edge * 0.72));
    }
  }

  if (current !== source) await deleteLocalPhoto(source);
  return { uri: current, width, height };
}

export async function preparePhotoUpload(photo: LocalPhoto): Promise<{
  body: UploadInspectorPhoto;
  localUri: string;
}> {
  const compressed = await compressPhotoToFile(photo);
  const contentBase64 = await FileSystem.readAsStringAsync(compressed.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!contentBase64) {
    throw new Error('Could not encode the photo for upload.');
  }
  return {
    localUri: compressed.uri,
    body: {
      fileName: `inspection-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: Math.floor((contentBase64.length * 3) / 4),
      contentBase64,
    },
  };
}

/** Resize to a JPEG under the inspection budget and return the Nest photos/upload body (no data: prefix). */
export async function compressPhotoForUpload(
  photo: LocalPhoto,
): Promise<UploadInspectorPhoto> {
  return (await preparePhotoUpload(photo)).body;
}
