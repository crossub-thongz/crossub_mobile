import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import {
  fetchCurrentUser,
  loginWithPassword,
  loginWithToken,
  logoutRemote,
  registerInspectorAccount,
} from '@/src/api/client';
import {
  clearSession,
  getAccessToken,
  getSessionStartedAt,
  loadStoredUser,
  markSessionStarted,
  saveUser,
} from '@/src/auth/session';
import type { AuthUser } from '@/src/auth/types';
import {
  OFFLINE_FLUSH_TIMEOUT_MS,
  SESSION_CHECK_MS,
  SESSION_MAX_MS,
} from '@/src/constants/auth';
import { flushOfflineWork } from '@/src/offline/sync';
import { unregisterInspectorPush } from '@/src/push/register-push';

export type AuthStatus = 'loading' | 'authed' | 'guest';

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  loginWithMagicLink: (token: string) => Promise<void>;
  register: (body: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function withFlushTimeout<T>(work: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), OFFLINE_FLUSH_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function flushLocalWork(): Promise<void> {
  await withFlushTimeout(flushOfflineWork());
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const loggingOutRef = useRef(false);

  const finishLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    try {
      await flushLocalWork();
      await unregisterInspectorPush().catch(() => undefined);
      await logoutRemote();
      setUser(null);
      setStatus('guest');
    } finally {
      loggingOutRef.current = false;
    }
  }, []);

  const checkSessionExpiry = useCallback(async () => {
    if (loggingOutRef.current) return;
    const started = await getSessionStartedAt();
    if (!started) {
      await markSessionStarted();
      return;
    }
    if (Date.now() - started < SESSION_MAX_MS) return;
    await finishLogout();
  }, [finishLogout]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const access = await getAccessToken();
      if (!access) {
        await clearSession();
        if (!cancelled) {
          setUser(null);
          setStatus('guest');
        }
        return;
      }

      try {
        const live = await fetchCurrentUser();
        if (cancelled) return;
        await saveUser(live);
        if (!(await getSessionStartedAt())) await markSessionStarted();
        setUser(live);
        setStatus('authed');
        void flushLocalWork();
        void checkSessionExpiry();
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '';
        const expired = /401|expired|sign in again/i.test(message);
        const stored = await loadStoredUser();
        const stillHasToken = Boolean(await getAccessToken());
        if (!expired && stillHasToken && stored) {
          if (!(await getSessionStartedAt())) await markSessionStarted();
          setUser(stored);
          setStatus('authed');
          void flushLocalWork();
          return;
        }
        await flushLocalWork();
        await clearSession();
        setUser(null);
        setStatus('guest');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [checkSessionExpiry]);

  useEffect(() => {
    if (status !== 'authed') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkSessionExpiry();
        void flushLocalWork();
      }
    });
    const timer = setInterval(() => {
      void checkSessionExpiry();
    }, SESSION_CHECK_MS);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [status, checkSessionExpiry]);

  const login = useCallback(async (email: string, password: string) => {
    const next = await loginWithPassword(email, password);
    const live = await fetchCurrentUser().catch(() => next);
    await saveUser(live);
    await markSessionStarted();
    setUser(live);
    setStatus('authed');
    await flushLocalWork();
  }, []);

  const loginWithMagicLink = useCallback(async (token: string) => {
    const next = await loginWithToken(token);
    const live = await fetchCurrentUser().catch(() => next);
    await saveUser(live);
    await markSessionStarted();
    setUser(live);
    setStatus('authed');
    await flushLocalWork();
  }, []);

  const register = useCallback(
    async (body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      const next = await registerInspectorAccount(body);
      const live = await fetchCurrentUser().catch(() => next);
      await saveUser(live);
      await markSessionStarted();
      setUser(live);
      setStatus('authed');
      await flushLocalWork();
    },
    [],
  );

  const logout = useCallback(async () => {
    await finishLogout();
  }, [finishLogout]);

  const refreshUser = useCallback(async () => {
    const live = await fetchCurrentUser();
    await saveUser(live);
    setUser(live);
    setStatus('authed');
  }, []);

  const value = useMemo(
    () => ({ user, status, login, loginWithMagicLink, register, logout, refreshUser }),
    [user, status, login, loginWithMagicLink, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
