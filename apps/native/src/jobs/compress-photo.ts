import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { UploadInspectorPhoto } from '@/src/api/inspector';
import { readLocalFileBase64, resolveLocalFileUri } from '@/src/lib/local-file';

/**
 * Longest edge for inspection evidence.
 * Downloaded Exit packs land at ~40-50 KB per file (~16.4 MB / 403 photos). 1024px JPEG
 * at moderate quality matches that ratio so 2000 photos stay around 100 MB on device.
 */
export const INSPECTION_PHOTO_MAX_EDGE = 1024;
/** Cap each JPEG at 50 KB. Compression runs on the phone before recording, not on Nest. */
export const INSPECTION_PHOTO_MAX_BYTES = 50_000;
export const INSPECTION_BURST_MAX = 80;

const START_QUALITY = 0.5;
const MIN_QUALITY = 0.32;
const MIN_EDGE = 640;
const QUALITY_STEP = 0.1;
const EDGE_SCALE = 0.78;

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

function withinInspectionBudget(size: number, width: number, height: number): boolean {
  if (size <= 0 || size > INSPECTION_PHOTO_MAX_BYTES) return false;
  if (width <= 0 || height <= 0) return true;
  return width <= INSPECTION_PHOTO_MAX_EDGE && height <= INSPECTION_PHOTO_MAX_EDGE;
}

/**
 * Resize and JPEG-encode to a cache file. Never returns base64.
 * Drops the original capture file when a smaller copy is written.
 * Call this on the device as soon as a photo is taken, before recording.
 */
export async function compressPhotoToFile(photo: LocalPhoto): Promise<LocalPhoto> {
  const resolved = await resolveLocalFileUri(photo.uri);
  if (!resolved) {
    throw new Error('That photo is no longer on this phone. Take it again.');
  }
  const sourcePhoto = { ...photo, uri: resolved };
  const existing = await fileSize(sourcePhoto.uri);
  if (withinInspectionBudget(existing, sourcePhoto.width, sourcePhoto.height)) {
    return sourcePhoto;
  }

  let source = sourcePhoto.uri;
  let width = sourcePhoto.width;
  let height = sourcePhoto.height;
  let quality = START_QUALITY;
  let edge = INSPECTION_PHOTO_MAX_EDGE;
  let current = sourcePhoto.uri;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    let result: { uri: string; width: number; height: number };
    try {
      result = await manipulateAsync(current, resizeActions(width, height, edge), {
        compress: quality,
        format: SaveFormat.JPEG,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
      if (
        message.includes('no such file') ||
        message.includes('could not load') ||
        message.includes('imageloadingfailed')
      ) {
        throw new Error('That photo is no longer on this phone. Take it again.');
      }
      throw new Error('Could not save the photo on this device.');
    }
    if (result.uri !== current && current !== source) {
      await deleteLocalPhoto(current);
    }
    current = result.uri;
    width = result.width;
    height = result.height;
    const size = await fileSize(current);
    if (size > 0 && size <= INSPECTION_PHOTO_MAX_BYTES) break;
    if (quality > MIN_QUALITY + 0.01) {
      quality = Math.max(MIN_QUALITY, quality - QUALITY_STEP);
    } else {
      edge = Math.max(MIN_EDGE, Math.round(edge * EDGE_SCALE));
    }
  }

  return { uri: current, width, height };
}

export async function preparePhotoUpload(photo: LocalPhoto): Promise<{
  body: UploadInspectorPhoto;
  localUri: string;
}> {
  const compressed = await compressPhotoToFile(photo);
  const { uri, contentBase64 } = await readLocalFileBase64(compressed.uri);
  return {
    localUri: uri,
    body: {
      fileName: `inspection-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: Math.floor((contentBase64.length * 3) / 4),
      contentBase64,
    },
  };
}

/** Read a photo already saved on this phone. Do not run ImageManipulator again. */
export async function prepareStoredPhotoUpload(uri: string): Promise<{
  body: UploadInspectorPhoto;
  localUri: string;
}> {
  const { uri: localUri, contentBase64 } = await readLocalFileBase64(uri);
  return {
    localUri,
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
