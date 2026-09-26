/**
 * Downscale + re-encode proof photos on the device before upload.
 * Exit photo packs download at ~40-50 KB each (~16.4 MB / 403 files). Matching that
 * ratio keeps 2000 inspection photos around 100 MB and avoids Nest-side compression.
 */
export const INSPECTION_PHOTO_MAX_EDGE = 1024;
export const INSPECTION_PHOTO_MAX_BYTES = 50_000;
const MAX_BASE64_CHARS = Math.ceil((INSPECTION_PHOTO_MAX_BYTES * 4) / 3);
const START_QUALITY = 0.5;
const MIN_QUALITY = 0.32;

export const IMAGE_UPLOAD_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,image/*,.heic,.heif';

export function dataUrlToUploadParts(
  dataUrl: string,
): { mimeType: string; contentBase64: string; sizeBytes: number } | null {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, mimeType, contentBase64] = match;
  return {
    mimeType,
    contentBase64,
    sizeBytes: Math.floor((contentBase64.length * 3) / 4),
  };
}

/** Base64 payload length inside a data URL (excludes the `data:...;base64,` prefix). */
export function dataUrlBase64Length(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.length - comma - 1 : dataUrl.length;
}

export function looksLikeImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?)$/i.test(file.name);
}

/** Re-encode an existing data URL if it exceeds the inspection photo budget. */
export async function shrinkDataUrlForUpload(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith('data:image/')) return dataUrl;
  if (dataUrlBase64Length(dataUrl) <= MAX_BASE64_CHARS) return dataUrl;

  const image = await loadImage(dataUrl);
  return encodeImageAsJpeg(image, INSPECTION_PHOTO_MAX_EDGE);
}

export async function compressImageForUpload(
  file: File,
  maxEdge = INSPECTION_PHOTO_MAX_EDGE,
): Promise<string> {
  if (!looksLikeImageFile(file)) {
    throw new Error('Please choose a photo (JPEG, PNG, or HEIC).');
  }

  try {
    const image = await decodeImageFile(file);
    try {
      return encodeImageAsJpeg(image, maxEdge);
    } finally {
      if ('close' in image && typeof image.close === 'function') {
        image.close();
      }
    }
  } catch (err) {
    if (err instanceof Error && /too large/i.test(err.message)) {
      throw err;
    }
    const fallback = await readFileAsDataUrl(file);
    if (
      /^data:image\/(jpeg|jpg|png|webp)/i.test(fallback) &&
      dataUrlBase64Length(fallback) <= MAX_BASE64_CHARS
    ) {
      return fallback;
    }
    throw new Error(
      'This photo is too large or in a format the browser cannot compress. Try a JPEG or PNG, or a smaller file.',
    );
  }
}

function encodeImageAsJpeg(
  image: CanvasImageSource & { width: number; height: number },
  maxEdge: number,
): string {
  let width = image.width;
  let height = image.height;
  const longest = Math.max(width, height);
  if (longest > maxEdge) {
    const scale = maxEdge / longest;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  let canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not process photo');
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const dataUrl = canvasToJpeg(canvas);
    if (dataUrlBase64Length(dataUrl) <= MAX_BASE64_CHARS) {
      return dataUrl;
    }
    const next = document.createElement('canvas');
    next.width = Math.max(1, Math.round(canvas.width * 0.78));
    next.height = Math.max(1, Math.round(canvas.height * 0.78));
    const nextCtx = next.getContext('2d');
    if (!nextCtx) {
      throw new Error('Could not shrink photo');
    }
    nextCtx.fillStyle = '#ffffff';
    nextCtx.fillRect(0, 0, next.width, next.height);
    nextCtx.drawImage(canvas, 0, 0, next.width, next.height);
    canvas = next;
  }

  return canvasToJpeg(canvas);
}

function canvasToJpeg(canvas: HTMLCanvasElement): string {
  let quality = START_QUALITY;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlBase64Length(dataUrl) > MAX_BASE64_CHARS && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.1);
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  return dataUrl;
}

/** JPEG re-encode loop used by the in-app camera capture canvas. */
export function compressCanvasToDataUrl(canvas: HTMLCanvasElement): string {
  return encodeImageAsJpeg(canvas, INSPECTION_PHOTO_MAX_EDGE);
}

export function dataUrlToFile(dataUrl: string, fileName: string): File | null {
  const parts = dataUrlToUploadParts(dataUrl);
  if (!parts) return null;
  const binary = atob(parts.contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], fileName, { type: parts.mimeType });
}

async function decodeImageFile(
  file: File,
): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, {
        imageOrientation: 'from-image',
      } as ImageBitmapOptions);
    } catch {
      // HEIC on desktop Chrome, or a truncated file — try the <img> path.
    }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image'));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read photo'));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to read photo'));
    reader.readAsDataURL(file);
  });
}
