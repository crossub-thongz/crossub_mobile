import { createCrossubClient } from '@crossub-thongz/api-contract';

import { getApiOrigin, getV1BaseUrl } from '@/src/config/api-url';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession,
} from '@/src/auth/session';
import { parseAuthUser, type AuthUser } from '@/src/auth/types';
import type { SystemAccessAgreementView } from '@/src/lib/system-access-agreement';

function isAuthUrl(url: string): boolean {
  return /\/auth\/(login|login-with-token|refresh|logout|register-inspector|forgot-password|reset-password)(\?|$)/.test(
    url,
  );
}

async function readApiMessage(res: Response, fallback: string): Promise<string> {
  try {
    const json = (await res.json()) as { message?: string | string[] };
    const msg = json.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
    if (Array.isArray(msg) && msg.length > 0) return msg.join(', ');
  } catch {
    // body was not JSON
  }
  return fallback;
}

function authUrl(path: string): string {
  return `${getApiOrigin()}/api${path}`;
}

async function attachAccessToken(request: Request): Promise<Request> {
  const headers = new Headers(request.headers);
  const token = await getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return new Request(request, { headers });
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;
      const res = await fetch(`${getV1BaseUrl()}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as {
        accessToken?: string;
        refreshToken?: string;
        user?: unknown;
      };
      if (!body.accessToken || !body.refreshToken) return false;
      await saveSession(
        { accessToken: body.accessToken, refreshToken: body.refreshToken },
        parseAuthUser(body.user),
      );
      return true;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function fetchWithBearer(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    const original = input instanceof Request ? input : new Request(input, init);
    const first = await attachAccessToken(original.clone());
    let res = await fetch(first);
    if (res.status !== 401 || isAuthUrl(first.url)) return res;
    if (!(await refreshSession())) return res;
    const retry = await attachAccessToken(original.clone());
    return await fetch(retry);
  } catch (err) {
    throw new Error(
      apiErrorMessage(
        err,
        'Could not reach the server. Check your connection and try again.',
      ),
    );
  }
}

export const crossub = createCrossubClient({
  baseUrl: getV1BaseUrl(),
  fetch: fetchWithBearer,
});

const MAX_DISPLAY_MESSAGE = 280;

function extractRawMessage(error: unknown): string {
  if (typeof error === 'string') return error.trim();
  if (!error || typeof error !== 'object') return '';
  const record = error as { message?: unknown; error?: unknown };
  const msg = record.message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  if (Array.isArray(msg)) {
    return msg.filter((part) => typeof part === 'string').join(', ').trim();
  }
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error.trim();
  }
  return '';
}

function isMissingPhotoError(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('imageloadingfailedexception') ||
    lower.includes('no such file') ||
    lower.includes('could not load the image') ||
    lower.includes('could not encode the photo') ||
    lower.includes('missing from this device') ||
    lower.includes('no longer on this phone') ||
    lower.includes('nscocoaerrordomain code=260')
  );
}

function looksLikeNativeOrStackDump(text: string): boolean {
  return (
    /\(at\s+\S+\)/.test(text) ||
    /ExpoModulesCore/i.test(text) ||
    /\.swift:\d+/i.test(text) ||
    /UnexpectedException/i.test(text) ||
    /TypeError:/i.test(text) ||
    /\n\s+at\s+/.test(text)
  );
}

function isOfflineTransport(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('internet connection appears to be offline') ||
    lower.includes('the internet connection') ||
    lower.includes('not connected to the internet') ||
    lower.includes('network connection was lost') ||
    lower.includes('seems to be offline') ||
    (lower.includes('offline') &&
      (lower.includes('internet') || lower.includes('connection')))
  );
}

function isTransportFailure(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    isOfflineTransport(text) ||
    looksLikeNativeOrStackDump(text) ||
    lower.includes('fetch failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network request failed') ||
    lower.includes('could not reach nest') ||
    lower.includes('could not reach the server') ||
    lower.includes('expo_public') ||
    lower.includes('unable to resolve host') ||
    lower.includes('failed to connect') ||
    lower.includes('hostname could not be found') ||
    lower.includes('nsurlerror') ||
    lower.includes('econnrefused') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound') ||
    lower.includes('the request timed out') ||
    lower.includes('socket hang up')
  );
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const raw = extractRawMessage(error);
  if (!raw) return fallback;
  if (isMissingPhotoError(raw)) {
    return 'That photo is no longer on this phone. Take it again.';
  }
  if (isOfflineTransport(raw)) {
    return 'No internet connection. Connect and try again.';
  }
  if (isTransportFailure(raw)) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  if (raw.length > MAX_DISPLAY_MESSAGE) return fallback;
  if (/<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(raw)) return fallback;
  return raw;
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<AuthUser> {
  let data: {
    accessToken?: string;
    refreshToken?: string;
    user?: unknown;
  } | undefined;
  let error: unknown;
  let status = 0;
  try {
    const result = await crossub.POST('/auth/login', {
      body: { email, password },
    });
    data = result.data;
    error = result.error;
    status = result.response.status;
  } catch {
    throw new Error(
      `Could not reach Nest at ${getApiOrigin()}. Check EXPO_PUBLIC_API_URL.`,
    );
  }
  if (status === 401) {
    throw new Error('Invalid email or password.');
  }
  if (error || !data?.accessToken || !data.refreshToken) {
    throw new Error(apiErrorMessage(error, 'Could not sign in. Is the API reachable?'));
  }
  const user = parseAuthUser(data.user);
  if (!user) {
    throw new Error('Login succeeded but the API did not return a user.');
  }
  await saveSession(
    { accessToken: data.accessToken, refreshToken: data.refreshToken },
    user,
  );
  return user;
}

export async function loginWithToken(token: string): Promise<AuthUser> {
  let data: {
    accessToken?: string;
    refreshToken?: string;
    user?: unknown;
  } | undefined;
  let error: unknown;
  let status = 0;
  try {
    const result = await crossub.POST('/auth/login-with-token', {
      body: { token },
    });
    data = result.data;
    error = result.error;
    status = result.response.status;
  } catch {
    throw new Error(
      `Could not reach Nest at ${getApiOrigin()}. Check EXPO_PUBLIC_API_URL.`,
    );
  }
  if (status === 401) {
    throw new Error('This sign-in link is invalid or has expired.');
  }
  if (error || !data?.accessToken || !data.refreshToken) {
    throw new Error(apiErrorMessage(error, 'Could not sign you in. Request a new link from the office.'));
  }
  const user = parseAuthUser(data.user);
  if (!user) {
    throw new Error('Login succeeded but the API did not return a user.');
  }
  await saveSession(
    { accessToken: data.accessToken, refreshToken: data.refreshToken },
    user,
  );
  return user;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await fetchWithBearer(`${getApiOrigin()}/api/auth/me`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? 'Session expired — sign in again.'
        : `Could not load /auth/me (${res.status}).`,
    );
  }
  const body = (await res.json()) as { user?: unknown };
  const user = parseAuthUser(body.user);
  if (!user) throw new Error('GET /auth/me did not return a user.');
  return user;
}

/** Cookie/web auth controller — accepts Bearer the same way as GET /api/auth/me. */
export async function changePassword(body: {
  currentPassword?: string;
  newPassword: string;
}): Promise<AuthUser | null> {
  const res = await fetchWithBearer(`${getApiOrigin()}/api/auth/change-password`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = 'Unable to change password.';
    try {
      const json = (await res.json()) as { message?: string | string[] };
      const msg = json.message;
      if (typeof msg === 'string' && msg.trim()) detail = msg;
      else if (Array.isArray(msg) && msg.length > 0) detail = msg.join(', ');
    } catch {
      if (res.status === 401) detail = 'Session expired — sign in again.';
    }
    throw new Error(detail);
  }
  try {
    const json = (await res.json()) as { user?: unknown };
    return parseAuthUser(json.user);
  } catch {
    return null;
  }
}

export async function registerInspectorAccount(body: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<AuthUser> {
  let res: Response;
  try {
    res = await fetch(authUrl('/auth/register-inspector'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`Could not reach Nest at ${getApiOrigin()}. Check EXPO_PUBLIC_API_URL.`);
  }
  if (res.status === 409) {
    throw new Error('An account with this email already exists. Sign in instead.');
  }
  if (res.status === 403) {
    throw new Error(
      await readApiMessage(
        res,
        'This email is not invited to register. Ask Operations to send you an invite.',
      ),
    );
  }
  if (res.status === 400) {
    throw new Error(
      await readApiMessage(res, 'Check your details — password must be at least 10 characters.'),
    );
  }
  if (!res.ok) {
    throw new Error(await readApiMessage(res, 'Could not create account.'));
  }
  return loginWithPassword(body.email, body.password);
}

export async function requestPasswordReset(email: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(authUrl('/auth/forgot-password'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch {
    throw new Error(`Could not reach Nest at ${getApiOrigin()}. Check EXPO_PUBLIC_API_URL.`);
  }
  if (!res.ok) {
    throw new Error(await readApiMessage(res, `Request failed (${res.status})`));
  }
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(authUrl('/auth/reset-password'), {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
  } catch {
    throw new Error(`Could not reach Nest at ${getApiOrigin()}. Check EXPO_PUBLIC_API_URL.`);
  }
  if (res.status === 401) {
    throw new Error('This reset link is invalid or has expired.');
  }
  if (!res.ok) {
    throw new Error(await readApiMessage(res, 'Unable to reset password. Please try again.'));
  }
}

export async function fetchSystemAccessAgreement(): Promise<SystemAccessAgreementView> {
  const res = await fetchWithBearer(
    authUrl('/auth/system-access-agreement?portal=inspector'),
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) {
    throw new Error(await readApiMessage(res, 'Unable to load the system access agreement.'));
  }
  return (await res.json()) as SystemAccessAgreementView;
}

export async function acceptSystemAccessAgreement(signerName: string): Promise<void> {
  const res = await fetchWithBearer(authUrl('/auth/system-access-agreement/accept'), {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ signerName, agreed: true, portal: 'inspector' }),
  });
  if (!res.ok) {
    throw new Error(await readApiMessage(res, 'Unable to record your agreement.'));
  }
  await refreshSession();
}

export async function logoutRemote(): Promise<void> {
  const refreshToken = await getRefreshToken();
  try {
    if (refreshToken) {
      await crossub.POST('/auth/logout', { body: { refreshToken } });
    }
  } catch {
    // Still drop local tokens if the API is unreachable.
  }
  await clearSession();
}
