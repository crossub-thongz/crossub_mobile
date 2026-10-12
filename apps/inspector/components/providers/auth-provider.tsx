'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import { api, ApiError } from '@/lib/api';
import type { AuthUser } from '@/lib/auth-types';
import { clearAllInspectorRegistrations } from '@/lib/inspector-registration';
import { clearLocalSession } from '@/lib/local-auth';

type AuthStatus = 'loading' | 'authed' | 'guest';

interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  /** Resolves with the signed-in user, or null when there is no session. */
  refresh: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const refresh = useCallback(async (): Promise<AuthUser | null> => {
    clearLocalSession();

    try {
      const data = await api.get<{ user: AuthUser }>('/auth/me');
      setUser(data.user);
      setStatus('authed');
      return data.user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setStatus('guest');
        return null;
      }
    }

    setUser(null);
    setStatus('guest');
    return null;
  }, []);

  const logout = useCallback(async () => {
    clearLocalSession();
    clearAllInspectorRegistrations();
    try {
      await api.post('/auth/logout');
    } catch {
      /* API may be offline — still send the user to login */
    }
    setUser(null);
    setStatus('guest');
    if (typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, status, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
