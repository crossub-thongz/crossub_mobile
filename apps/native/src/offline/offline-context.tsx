import * as Network from 'expo-network';
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

import { useAuth } from '@/src/auth/auth-context';
import { pendingSyncCount, subscribeQueueChanged } from '@/src/offline/db';
import { flushOfflineWork, syncOfflineQueue } from '@/src/offline/sync';

type OfflineContextValue = {
  pendingSync: number;
  syncing: boolean;
  lastError: string | null;
  refreshPending: () => Promise<void>;
  syncNow: () => Promise<{ synced: number; remaining: number }>;
};

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshPending = useCallback(async () => {
    setPendingSync(await pendingSyncCount());
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current) {
      return syncOfflineQueue();
    }
    syncingRef.current = true;
    setSyncing(true);
    setLastError(null);
    try {
      const result = await flushOfflineWork();
      setPendingSync(result.remaining);
      if (result.remaining > 0 && result.synced === 0) {
        setLastError('Still waiting to reach the server. Tap Sync now to retry.');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sync queued changes.';
      setLastError(message);
      await refreshPending();
      throw err;
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshPending]);

  useEffect(() => {
    void refreshPending();
    return subscribeQueueChanged(() => {
      void refreshPending();
    });
  }, [refreshPending]);

  useEffect(() => {
    if (status !== 'authed') return;
    void syncNow().catch(() => undefined);
  }, [status, syncNow]);

  useEffect(() => {
    if (status !== 'authed') return;
    const sub = Network.addNetworkStateListener((state) => {
      if (state.isConnected) {
        void syncNow().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [status, syncNow]);

  useEffect(() => {
    if (status !== 'authed') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncNow().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [status, syncNow]);

  const value = useMemo(
    () => ({ pendingSync, syncing, lastError, refreshPending, syncNow }),
    [pendingSync, syncing, lastError, refreshPending, syncNow],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used inside OfflineProvider');
  return ctx;
}
