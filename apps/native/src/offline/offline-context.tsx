import * as Network from 'expo-network';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { pendingSyncCount } from '@/src/offline/db';
import { syncOfflineQueue } from '@/src/offline/sync';

type OfflineContextValue = {
  pendingSync: number;
  syncing: boolean;
  lastError: string | null;
  refreshPending: () => Promise<void>;
  syncNow: () => Promise<{ synced: number; remaining: number }>;
};

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const refreshPending = useCallback(async () => {
    setPendingSync(await pendingSyncCount());
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setLastError(null);
    try {
      const result = await syncOfflineQueue();
      setPendingSync(result.remaining);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not sync queued changes.';
      setLastError(message);
      await refreshPending();
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [refreshPending]);

  useEffect(() => {
    void refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    const sub = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void syncNow().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [syncNow]);

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
