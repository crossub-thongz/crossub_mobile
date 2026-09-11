import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchInspectorJobs } from '@/src/api/inspector';
import { useAuth } from '@/src/auth/auth-context';
import { isThisWeek } from '@/src/lib/datetime';
import { mapInspectorEarnings, type EarningsRecord } from '@/src/lib/earnings';

type LedgerContextValue = {
  earnings: EarningsRecord[];
  weeklyEarnings: number;
  unclaimedEarnings: number;
  claimedEarnings: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const LedgerContext = createContext<LedgerContextValue | undefined>(undefined);

export function LedgerProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [earnings, setEarnings] = useState<EarningsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (status !== 'authed') {
      setEarnings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = mapInspectorEarnings(await fetchInspectorJobs());
      rows.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      setEarnings(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const weeklyEarnings = useMemo(
    () =>
      earnings
        .filter((row) => isThisWeek(row.completedAt))
        .reduce((sum, row) => sum + row.laborAmount, 0),
    [earnings],
  );
  const claimedEarnings = useMemo(
    () =>
      earnings
        .filter((row) => row.accountingSynced)
        .reduce((sum, row) => sum + row.laborAmount, 0),
    [earnings],
  );
  const unclaimedEarnings = useMemo(
    () =>
      earnings
        .filter((row) => !row.accountingSynced)
        .reduce((sum, row) => sum + row.laborAmount, 0),
    [earnings],
  );

  const value = useMemo(
    () => ({
      earnings,
      weeklyEarnings,
      unclaimedEarnings,
      claimedEarnings,
      loading,
      error,
      refresh: load,
    }),
    [earnings, weeklyEarnings, unclaimedEarnings, claimedEarnings, loading, error, load],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used inside LedgerProvider');
  return ctx;
}
