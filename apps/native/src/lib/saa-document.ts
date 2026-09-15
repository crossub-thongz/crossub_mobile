import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { fetchWithBearer } from '@/src/api/client';
import { getApiOrigin } from '@/src/config/api-url';
import { INSPECTOR_SAA_PORTAL_QUERY } from '@/src/lib/system-access-agreement';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function documentUrl(documentPath?: string): string {
  const origin = getApiOrigin();
  const fallback = `/api/auth/system-access-agreement/document?${INSPECTOR_SAA_PORTAL_QUERY}`;
  const path = documentPath?.trim();
  if (!path) return `${origin}${fallback}`;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/api/')) return `${origin}${path}`;
  if (path.startsWith('/auth/')) return `${origin}/api${path}`;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function shareSystemAccessAgreementDocument(input?: {
  fileName?: string;
  documentPath?: string;
}): Promise<void> {
  const res = await fetchWithBearer(documentUrl(input?.documentPath), {
    headers: { Accept: 'application/pdf' },
  });
  if (!res.ok) {
    throw new Error('Could not open the agreement document.');
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error('Could not open the agreement document.');
  }
  const filename = (input?.fileName?.trim() || 'Inspector portal access agreement.pdf').replace(
    /[\\/:*?"<>|]/g,
    ' ',
  );
  const path = `${FileSystem.cacheDirectory ?? ''}${filename}`;
  await FileSystem.writeAsStringAsync(path, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(path, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: filename,
  });
}
