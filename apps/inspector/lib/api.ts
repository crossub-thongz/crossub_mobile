import { ROUTES } from '@/constants/routes';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';

function formatApiErrorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message)) {
      const joined = message.filter((part) => typeof part === 'string').join(', ');
      if (joined) return joined;
    }
  }
  if (typeof body === 'string' && body.trim()) return body;
  return `API ${status}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(formatApiErrorMessage(status, body));
  }
}

const isAuthPath = (path: string): boolean => path.startsWith('/auth/');

let refreshInFlight: Promise<boolean> | null = null;

/** One refresh at a time — parallel 401s must not rotate the same refresh token twice. */
const tryRefreshSession = (): Promise<boolean> => {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

/** Clears stale httpOnly cookies so route middleware does not bounce /login away. */
const clearSessionAndRedirectToLogin = async (): Promise<never> => {
  if (typeof window === 'undefined') {
    throw new ApiError(401, 'Session expired');
  }

  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    // Best effort — ?session=expired lets middleware allow /login with a stale cookie.
  }

  const dest = `${ROUTES.LOGIN}?session=expired`;
  if (
    window.location.pathname !== ROUTES.LOGIN ||
    !window.location.search.includes('session=expired')
  ) {
    window.location.replace(dest);
  }
  throw new ApiError(401, 'Session expired');
};

const buildHeaders = (init?: RequestInit): HeadersInit => ({
  'Content-Type': 'application/json',
  ...(init?.headers ?? {}),
});

const REQUEST_TIMEOUT_MS = 30_000;

const doFetch = (path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${API_URL}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: buildHeaders(init),
  });

const parseBody = async (res: Response): Promise<unknown> => {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await doFetch(path, init);

  if (
    res.status === 401 &&
    typeof window !== 'undefined' &&
    !isAuthPath(path)
  ) {
    if (await tryRefreshSession()) {
      res = await doFetch(path, init);
    } else {
      return clearSessionAndRedirectToLogin();
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseBody(res));
  }
  return (await parseBody(res)) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
