import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  fetchCurrentUser,
  loginWithPassword,
  logoutRemote,
} from '@/src/api/client';
import { clearSession, getAccessToken, loadStoredUser, saveUser } from '@/src/auth/session';
import type { AuthUser } from '@/src/auth/types';

export type AuthStatus = 'loading' | 'authed' | 'guest';

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

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
        setUser(live);
        setStatus('authed');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : '';
        const expired = /401|expired|sign in again/i.test(message);
        const stored = await loadStoredUser();
        const stillHasToken = Boolean(await getAccessToken());
        if (!expired && stillHasToken && stored) {
          setUser(stored);
          setStatus('authed');
          return;
        }
        await clearSession();
        setUser(null);
        setStatus('guest');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const next = await loginWithPassword(email, password);
    const live = await fetchCurrentUser().catch(() => next);
    await saveUser(live);
    setUser(live);
    setStatus('authed');
  }, []);

  const logout = useCallback(async () => {
    await logoutRemote();
    setUser(null);
    setStatus('guest');
  }, []);

  const refreshUser = useCallback(async () => {
    const live = await fetchCurrentUser();
    await saveUser(live);
    setUser(live);
    setStatus('authed');
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, refreshUser }),
    [user, status, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
