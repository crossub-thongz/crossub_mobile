import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { downloadAuthorizedFile } from '@/src/api/client';
import { getV1BaseUrl } from '@/src/config/api-url';
import type { InspectionType } from '@/src/lib/types';

function reportTitle(type: InspectionType, address: string): string {
  const kind =
    type === 'ingoing' ? 'Entry' : type === 'outgoing' ? 'Exit' : type === 'routine' ? 'Routine' : 'Inspection';
  const safe = address.replace(/[\\/:*?"<>|]/g, ' ').trim() || 'property';
  return `${kind} report - ${safe}.pdf`;
}

/** Android's share intent splits on commas and some OEMs reject spaces in the file URI. */
function shareFileName(title: string): string {
  const stem = title.replace(/\.pdf$/i, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${stem || 'inspection-report'}.pdf`;
}

async function messageFromDownload(uri: string, fallback: string): Promise<string> {
  try {
    const text = await FileSystem.readAsStringAsync(uri);
    const json = JSON.parse(text) as { message?: string | string[] };
    const msg = json.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
    if (Array.isArray(msg) && msg.length > 0) {
      return msg.filter((part) => typeof part === 'string').join(', ');
    }
  } catch {
    // A real PDF is not JSON.
  }
  return fallback;
}

/** GET /inspector/inspections/{id}/report/pdf then open the system share sheet. */
export async function shareInspectionReportPdf(input: {
  inspectionId: string;
  type: InspectionType;
  propertyAddress: string;
}): Promise<void> {
  const cache = FileSystem.cacheDirectory;
  if (!cache) throw new Error('Could not save the report on this device.');
  const title = reportTitle(input.type, input.propertyAddress);
  const path = `${cache}${shareFileName(title)}`;
  const { status, uri } = await downloadAuthorizedFile(
    `${getV1BaseUrl()}/inspector/inspections/${encodeURIComponent(input.inspectionId)}/report/pdf`,
    path,
  );
  if (status === 404 || status === 409) {
    throw new Error(await messageFromDownload(uri, 'Inspection report is not available yet.'));
  }
  if (status < 200 || status >= 300) {
    throw new Error(await messageFromDownload(uri, `Could not download the report (${status}).`));
  }
  const info = await FileSystem.getInfoAsync(uri);
  const size = info.exists && 'size' in info ? info.size ?? 0 : 0;
  if (size < 5) {
    throw new Error('Inspection report is not available yet.');
  }
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: title,
  });
}
