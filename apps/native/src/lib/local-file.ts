import * as FileSystem from 'expo-file-system/legacy';

export function isRemotePhotoUrl(uri: string): boolean {
  return uri.startsWith('http://') || uri.startsWith('https://');
}

export function isDurableLocalPhoto(uri: string): boolean {
  return uri.includes('/offline-queue/');
}

export function asFileUri(uri: string): string {
  if (uri.startsWith('/') && !uri.startsWith('file:')) return `file://${uri}`;
  return uri;
}

/** True when two local file URIs point at the same path (/var vs /private/var). */
export function sameLocalPhotoUri(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (isRemotePhotoUrl(a) || isRemotePhotoUrl(b)) return false;
  const other = new Set(localFileCandidates(b));
  return localFileCandidates(a).some((item) => other.has(item));
}

export function localFileCandidates(uri: string): string[] {
  if (!uri) return [];
  let decoded = uri;
  try {
    decoded = decodeURI(uri);
  } catch {
    decoded = uri;
  }
  const withFile = asFileUri(uri);
  const withDecoded = asFileUri(decoded);
  const variants = [
    uri,
    decoded,
    withFile,
    withDecoded,
    withFile.replace('file:///var/', 'file:///private/var/'),
    withFile.replace('file:///private/var/', 'file:///var/'),
    withDecoded.replace('file:///var/', 'file:///private/var/'),
    withDecoded.replace('file:///private/var/', 'file:///var/'),
  ];
  const seen = new Set<string>();
  const next: string[] = [];
  for (const item of variants) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    next.push(item);
  }
  return next;
}

export async function resolveLocalFileUri(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (isRemotePhotoUrl(uri)) return uri;
  for (const candidate of localFileCandidates(uri)) {
    try {
      const info = await FileSystem.getInfoAsync(candidate);
      if (info.exists) return candidate;
    } catch {
      // Try the next URI shape.
    }
  }
  for (const candidate of localFileCandidates(uri)) {
    try {
      const data = await FileSystem.readAsStringAsync(candidate, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (data) return candidate;
    } catch {
      // Try the next URI shape.
    }
  }
  return null;
}

export async function localPhotoExists(uri: string): Promise<boolean> {
  if (!uri) return false;
  if (isRemotePhotoUrl(uri)) return true;
  return (await resolveLocalFileUri(uri)) != null;
}

export async function readLocalFileBase64(uri: string): Promise<{
  uri: string;
  contentBase64: string;
}> {
  const resolved = await resolveLocalFileUri(uri);
  if (!resolved || isRemotePhotoUrl(resolved)) {
    throw new Error('That photo is no longer on this phone. Take it again.');
  }
  const contentBase64 = await FileSystem.readAsStringAsync(resolved, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!contentBase64) {
    throw new Error('Could not encode the photo for upload.');
  }
  return { uri: resolved, contentBase64 };
}
