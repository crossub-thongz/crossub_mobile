import * as DocumentPicker from 'expo-document-picker';

export const MAX_MESSAGE_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type PendingAttachment = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  contentBase64: string;
};

const PICK_TYPES = [
  'image/*',
  'video/*',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function uriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const buffer = await response.arrayBuffer();
  return bytesToBase64(new Uint8Array(buffer));
}

export async function pickMessageAttachments(
  existingCount: number,
): Promise<PendingAttachment[]> {
  const remaining = MAX_MESSAGE_ATTACHMENTS - existingCount;
  if (remaining <= 0) {
    throw new Error(`At most ${MAX_MESSAGE_ATTACHMENTS} files per message`);
  }
  const result = await DocumentPicker.getDocumentAsync({
    type: PICK_TYPES,
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  const picked: PendingAttachment[] = [];
  for (const asset of result.assets.slice(0, remaining)) {
    const size = asset.size ?? 0;
    if (size > MAX_ATTACHMENT_BYTES) {
      throw new Error(`${asset.name} exceeds 10 MB`);
    }
    const contentBase64 = await uriToBase64(asset.uri);
    picked.push({
      fileName: asset.name,
      mimeType: asset.mimeType || 'application/octet-stream',
      sizeBytes: size || Math.floor((contentBase64.length * 3) / 4),
      contentBase64,
    });
  }
  return picked;
}
