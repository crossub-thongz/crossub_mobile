import * as FileSystem from 'expo-file-system/legacy';

import { deleteLocalPhoto } from '@/src/jobs/compress-photo';

const QUEUE_DIR = `${FileSystem.documentDirectory ?? ''}offline-queue/`;

async function ensureQueueDir(): Promise<string> {
  if (!QUEUE_DIR) throw new Error('Photo storage is not available on this device.');
  const info = await FileSystem.getInfoAsync(QUEUE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
  }
  return QUEUE_DIR;
}

function newQueuePhotoPath(): string {
  return `${QUEUE_DIR}photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
}

export async function localPhotoExists(uri: string): Promise<boolean> {
  if (!uri || !uri.startsWith('file:')) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return Boolean(info.exists);
  } catch {
    return false;
  }
}

/** Copy a cache/camera JPEG into app documents so iOS cannot purge it before drain. */
export async function persistQueuedPhoto(uri: string): Promise<string> {
  if (!uri.startsWith('file:')) return uri;
  if (uri.includes('/offline-queue/')) {
    if (await localPhotoExists(uri)) return uri;
  }
  await ensureQueueDir();
  const dest = newQueuePhotoPath();
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function writeQueuedPhotoFromBase64(contentBase64: string): Promise<string> {
  if (!contentBase64) throw new Error('Photo data was empty.');
  await ensureQueueDir();
  const dest = newQueuePhotoPath();
  await FileSystem.writeAsStringAsync(dest, contentBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return dest;
}

export async function deleteQueuedPhoto(uri: string | undefined): Promise<void> {
  if (!uri || !uri.includes('/offline-queue/')) return;
  await deleteLocalPhoto(uri);
}

export function stripBase64Payload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (!('contentBase64' in payload)) return payload;
  const { contentBase64: _ignored, ...rest } = payload;
  return rest;
}
