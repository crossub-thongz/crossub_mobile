const DEFAULT_ORIGIN = 'https://crossub-api-staging.onrender.com';

/** Nest origin only — never `/api` on the Next inspector host. */
export function getApiOrigin(): string {
  const raw = process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_ORIGIN;
  return raw.trim().replace(/\/+$/, '').replace(/\/api$/i, '');
}

export function getV1BaseUrl(): string {
  return `${getApiOrigin()}/api/v1`;
}
