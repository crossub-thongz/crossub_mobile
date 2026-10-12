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
import {
  listFailedQueueItems,
  pendingSyncCount,
  subscribeQueueChanged,
  type FailedQueueItem,
} from '@/src/offline/db';
import {
  flushOfflineWork,
  noteAppBackgrounded,
  noteAppForegrounded,
  subscribeSyncProgress,
  syncOfflineQueue,
  type SyncProgress,
} from '@/src/offline/sync';

type OfflineContextValue = {
  pendingSync: number;
  failedSync: FailedQueueItem[];
  syncing: boolean;
  syncProgress: SyncProgress | null;
  lastError: string | null;
  refreshPending: () => Promise<void>;
  syncNow: (force?: boolean) => Promise<{ synced: number; remaining: number; failed: string[] }>;
};

const OfflineContext = createContext<OfflineContextValue | undefined>(undefined);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [pendingSync, setPendingSync] = useState(0);
  const [failedSync, setFailedSync] = useState<FailedQueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const syncingRef = useRef(false);

  const refreshPending = useCallback(async () => {
    setPendingSync(await pendingSyncCount());
    setFailedSync(await listFailedQueueItems());
  }, []);

  const syncNow = useCallback(async (force = false) => {
    if (syncingRef.current) {
      return syncOfflineQueue(force ? { force: true } : undefined);
    }
    syncingRef.current = true;
    setSyncing(true);
    setLastError(null);
    try {
      const result = await flushOfflineWork(force ? { force: true } : undefined);
      setPendingSync(result.remaining);
      const rejected = [...new Set(result.failed)];
      if (rejected.length === 1) {
        setLastError(`Skipped a change the server rejected: ${rejected[0]}`);
      } else if (rejected.length > 1) {
        setLastError(
          `Skipped ${rejected.length} changes the server rejected. The rest kept syncing.`,
        );
      } else if (result.remaining > 0 && result.synced === 0) {
        setLastError('Still waiting to reach the server. Tap Sync now to retry.');
      }
      await refreshPending();
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
    return subscribeSyncProgress(setSyncProgress);
  }, []);

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
        noteAppForegrounded();
        return;
      }
      if (state === 'inactive' || state === 'background') {
        noteAppBackgrounded();
        void syncOfflineQueue().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [status, syncNow]);

  const value = useMemo(
    () => ({
      pendingSync,
      failedSync,
      syncing,
      syncProgress,
      lastError,
      refreshPending,
      syncNow,
    }),
    [pendingSync, failedSync, syncing, syncProgress, lastError, refreshPending, syncNow],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used inside OfflineProvider');
  return ctx;
}
