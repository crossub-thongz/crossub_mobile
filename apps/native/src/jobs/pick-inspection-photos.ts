import * as ImagePicker from 'expo-image-picker';

import {
  INSPECTION_BURST_MAX,
  compressPhotoToFile,
  type LocalPhoto,
} from '@/src/jobs/compress-photo';

/** Pick JPEGs from the library and compress them the same way as camera shots. */
export async function pickInspectionPhotos(): Promise<LocalPhoto[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow photo library access to upload inspection photos.');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    quality: 0.6,
    selectionLimit: INSPECTION_BURST_MAX,
  });
  if (result.canceled) return [];
  const photos: LocalPhoto[] = [];
  for (const asset of result.assets) {
    if (!asset.uri) continue;
    photos.push(
      await compressPhotoToFile({
        uri: asset.uri,
        width: asset.width ?? 0,
        height: asset.height ?? 0,
      }),
    );
  }
  return photos;
}
