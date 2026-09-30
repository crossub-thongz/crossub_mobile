import * as DocumentPicker from 'expo-document-picker';
import { launchImageLibraryAsync } from 'expo-image-picker';

import {
  INSPECTION_BURST_MAX,
  deleteLocalPhoto,
  yieldToUi,
  type LocalPhoto,
} from '@/src/jobs/compress-photo';
import { persistQueuedPhoto } from '@/src/offline/queued-photo';

type PickedAsset = {
  uri?: string | null;
  width?: number | null;
  height?: number | null;
};

type LibraryOutcome =
  | { kind: 'photos'; photos: LocalPhoto[] }
  | { kind: 'canceled' }
  | { kind: 'failed' };

function assetsToPhotos(assets: PickedAsset[] | null | undefined, limit: number): LocalPhoto[] {
  const photos: LocalPhoto[] = [];
  for (const asset of assets ?? []) {
    if (typeof asset?.uri !== 'string' || asset.uri.length === 0) continue;
    photos.push({
      uri: asset.uri,
      width: asset.width ?? 0,
      height: asset.height ?? 0,
    });
    if (photos.length >= limit) break;
  }
  return photos;
}

/**
 * Open the system photo picker. Do not call requestMediaLibraryPermissionsAsync:
 * that native binding is missing on this build and throws "undefined is not a function"
 * before the picker appears. PHPicker does not need that permission.
 */
async function openLibrary(limit: number): Promise<LibraryOutcome> {
  if (typeof launchImageLibraryAsync !== 'function') return { kind: 'failed' };
  const attempts = [
    {
      mediaTypes: ['images'] as const,
      allowsMultipleSelection: limit > 1,
      selectionLimit: limit,
      quality: 0.8,
      preferredAssetRepresentationMode: 'compatible' as const,
    },
    {
      mediaTypes: ['images'] as const,
      allowsMultipleSelection: false,
      quality: 0.8,
    },
  ];
  for (const options of attempts) {
    try {
      const result = await launchImageLibraryAsync(options);
      if (result?.canceled) return { kind: 'canceled' };
      return { kind: 'photos', photos: assetsToPhotos(result?.assets, limit) };
    } catch {
      // The multi-select picker can fail; try one photo next.
    }
  }
  return { kind: 'failed' };
}

async function pickFromFiles(limit: number): Promise<LocalPhoto[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*'],
    multiple: limit > 1,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return assetsToPhotos(result.assets, limit);
}

async function keepPhoto(photo: LocalPhoto): Promise<LocalPhoto | null> {
  try {
    const uri = await persistQueuedPhoto(photo.uri);
    if (uri !== photo.uri) await deleteLocalPhoto(photo.uri);
    return { ...photo, uri };
  } catch {
    return null;
  }
}

/**
 * Copy each picked file into app storage. Shrinking happens later, when the
 * photo is uploaded, so leaving this section does not cancel the save.
 */
export async function pickInspectionPhotos(
  limit = INSPECTION_BURST_MAX,
  onProgress?: (completed: number, total: number) => void,
  onEach?: (photo: LocalPhoto) => void,
): Promise<LocalPhoto[]> {
  const room = Math.max(1, Math.min(INSPECTION_BURST_MAX, limit));
  const library = await openLibrary(room);
  if (library.kind === 'canceled') return [];
  let picked = library.kind === 'photos' ? library.photos : [];
  if (picked.length === 0 && library.kind === 'failed') {
    try {
      picked = await pickFromFiles(room);
    } catch {
      picked = [];
    }
  }
  if (picked.length === 0) return [];
  onProgress?.(0, picked.length);
  const saved: LocalPhoto[] = [];
  let completed = 0;
  const saveCount = Math.min(4, picked.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: saveCount }, async () => {
      while (cursor < picked.length) {
        const photo = picked[cursor];
        cursor += 1;
        const savedPhoto = await keepPhoto(photo);
        if (!savedPhoto) {
          completed += 1;
          onProgress?.(completed, picked.length);
          continue;
        }
        saved.push(savedPhoto);
        onEach?.(savedPhoto);
        completed += 1;
        onProgress?.(completed, picked.length);
        await yieldToUi();
      }
    }),
  );
  return saved;
}
