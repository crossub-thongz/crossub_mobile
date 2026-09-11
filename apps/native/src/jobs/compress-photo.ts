import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { UploadInspectorPhoto } from '@/src/api/inspector';

const MAX_EDGE = 1920;

export type LocalPhoto = {
  uri: string;
  width: number;
  height: number;
};

/** Resize to ~1920px JPEG and return the Nest photos/upload body (no data: prefix). */
export async function compressPhotoForUpload(
  photo: LocalPhoto,
): Promise<UploadInspectorPhoto> {
  const actions =
    photo.width > MAX_EDGE || photo.height > MAX_EDGE
      ? photo.width >= photo.height
        ? [{ resize: { width: MAX_EDGE } }]
        : [{ resize: { height: MAX_EDGE } }]
      : [];

  const result = await manipulateAsync(photo.uri, actions, {
    compress: 0.7,
    format: SaveFormat.JPEG,
    base64: true,
  });
  const contentBase64 = result.base64;
  if (!contentBase64) {
    throw new Error('Could not encode the photo for upload.');
  }
  return {
    fileName: `inspection-${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: Math.floor((contentBase64.length * 3) / 4),
    contentBase64,
  };
}
