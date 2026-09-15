import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { fetchWithBearer } from '@/src/api/client';
import { getV1BaseUrl } from '@/src/config/api-url';
import type { InspectionType } from '@/src/lib/types';

function reportFilename(type: InspectionType, address: string): string {
  const kind =
    type === 'ingoing' ? 'Entry' : type === 'outgoing' ? 'Exit' : type === 'routine' ? 'Routine' : 'Inspection';
  const safe = address.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'property';
  return `${kind} report - ${safe}.pdf`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** GET /inspector/inspections/{id}/report/pdf then open the system share sheet. */
export async function shareInspectionReportPdf(input: {
  inspectionId: string;
  type: InspectionType;
  propertyAddress: string;
}): Promise<void> {
  const res = await fetchWithBearer(
    `${getV1BaseUrl()}/inspector/inspections/${encodeURIComponent(input.inspectionId)}/report/pdf`,
    { headers: { Accept: 'application/pdf' } },
  );
  if (!res.ok) {
    if (res.status === 404 || res.status === 409) {
      throw new Error('Inspection report is not available yet.');
    }
    throw new Error(`Could not download the report (${res.status}).`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new Error('Inspection report is not available yet.');
  }
  const filename = reportFilename(input.type, input.propertyAddress);
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
