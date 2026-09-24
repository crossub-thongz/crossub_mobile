import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import { deleteLocalPhoto } from '@/src/jobs/compress-photo';
import {
  asFileUri,
  isDurableLocalPhoto,
  isRemotePhotoUrl,
  localPhotoExists,
  resolveLocalFileUri,
  sameLocalPhotoUri,
} from '@/src/lib/local-file';

export {
  asFileUri,
  isDurableLocalPhoto,
  isRemotePhotoUrl,
  localPhotoExists,
  resolveLocalFileUri,
};

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

function indexOfPhotoUrl(urls: string[], target: string): number {
  if (!target) return -1;
  const exact = urls.indexOf(target);
  if (exact >= 0) return exact;
  return urls.findIndex((url) => sameLocalPhotoUri(url, target));
}

/** Keep a photo URL list in sync as a cache file is copied, then uploaded. */
export function upsertPhotoUrl(urls: string[], from: string, to: string): string[] {
  if (!to) return urls;
  const fromIndex = from && from !== to ? indexOfPhotoUrl(urls, from) : -1;
  if (fromIndex >= 0) {
    const alreadyHasTo = urls.some(
      (url, index) => index !== fromIndex && (url === to || sameLocalPhotoUri(url, to)),
    );
    if (alreadyHasTo) return urls.filter((_, index) => index !== fromIndex);
    return urls.map((url, index) => (index === fromIndex ? to : url));
  }
  if (indexOfPhotoUrl(urls, to) >= 0) return urls;
  return [...urls, to];
}

async function copyToQueue(from: string, dest: string): Promise<void> {
  await FileSystem.copyAsync({ from, to: dest });
}

/**
 * Copy a camera, library, or cache JPEG into app documents so iOS cannot purge
 * it when the inspector closes the app before sync.
 */
export async function persistQueuedPhoto(uri: string): Promise<string> {
  if (!uri) throw new Error('Photo is missing from this device.');
  if (isRemotePhotoUrl(uri)) return uri;
  const resolved = (await resolveLocalFileUri(uri)) ?? asFileUri(uri);
  const durable = isDurableLocalPhoto(resolved)
    ? await resolveLocalFileUri(resolved)
    : null;
  if (durable) return durable;

  await ensureQueueDir();
  const dest = newQueuePhotoPath();
  let copied = false;
  try {
    await copyToQueue(resolved, dest);
    copied = Boolean(await resolveLocalFileUri(dest));
  } catch {
    copied = false;
  }
  if (!copied) {
    try {
      const contentBase64 = await FileSystem.readAsStringAsync(resolved, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(dest, contentBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      let resultUri = '';
      try {
        const result = await manipulateAsync(resolved, [], {
          compress: 0.92,
          format: SaveFormat.JPEG,
        });
        resultUri = result.uri;
        await copyToQueue(result.uri, dest);
      } catch {
        throw new Error('Could not save the photo on this device.');
      } finally {
        if (resultUri && resultUri !== resolved && resultUri !== dest) {
          await deleteLocalPhoto(resultUri);
        }
      }
    }
  }
  const saved = await resolveLocalFileUri(dest);
  if (!saved) throw new Error('Could not save the photo on this device.');
  return saved;
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
