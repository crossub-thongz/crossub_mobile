import * as ImagePicker from 'expo-image-picker';

import {
  INSPECTION_BURST_MAX,
  deleteLocalPhoto,
  yieldToUi,
  type LocalPhoto,
} from '@/src/jobs/compress-photo';
import { compressAndPersistPhoto } from '@/src/offline/queued-photo';

/** Pick images from the library and compress each one before recording. */
export async function pickInspectionPhotos(
  limit = INSPECTION_BURST_MAX,
): Promise<LocalPhoto[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      permission.canAskAgain === false
        ? 'Allow photo library access in Settings, then try again.'
        : 'Allow photo library access to upload inspection photos.',
    );
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.5,
    selectionLimit: Math.max(1, Math.min(INSPECTION_BURST_MAX, limit)),
  });
  if (result.canceled) return [];
  const picked = result.assets
    .filter((asset) => Boolean(asset.uri))
    .map((asset) => ({
      uri: asset.uri,
      width: asset.width ?? 0,
      height: asset.height ?? 0,
    }));
  const compressed: LocalPhoto[] = [];
  for (const photo of picked) {
    await yieldToUi();
    const next = await compressAndPersistPhoto(photo);
    if (next.uri !== photo.uri) await deleteLocalPhoto(photo.uri);
    compressed.push(next);
  }
  return compressed;
}
