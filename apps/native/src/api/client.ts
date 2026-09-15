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
  const original = input instanceof Request ? input : new Request(input, init);
  const first = await attachAccessToken(original.clone());
  let res = await fetch(first);
  if (res.status !== 401 || isAuthUrl(first.url)) return res;
  if (!(await refreshSession())) return res;
  const retry = await attachAccessToken(original.clone());
  return fetch(retry);
}

export const crossub = createCrossubClient({
  baseUrl: getV1BaseUrl(),
  fetch: fetchWithBearer,
});

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;
  const record = error as { message?: unknown };
  const msg = record.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (Array.isArray(msg) && msg.length > 0) {
    return msg.filter((part) => typeof part === 'string').join(', ') || fallback;
  }
  return fallback;
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
