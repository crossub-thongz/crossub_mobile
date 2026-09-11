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
  acceptInspection,
  claimInspection,
  fetchInspections,
  fetchKeyCollection,
  fetchPoolInspections,
  type InspectorInspection,
} from '@/src/api/inspector';
import { useAuth } from '@/src/auth/auth-context';
import { isCoreInspectionType } from '@/src/constants/inspection';
import {
  byScheduleTime,
  isOverdueInspection,
  isPoolJob,
  isTodaysInspection,
  isUpcomingInspection,
} from '@/src/lib/inspector-job-filters';
import { mapAssignedJobs, mapPoolJobs, toInspectionJob } from '@/src/lib/job-map';
import { keyAccessFromCollection } from '@/src/lib/key-access';
import type { GeoPoint } from '@/src/lib/travel';
import type { InspectionJob, RoutineExecutionDraft } from '@/src/lib/types';
import { useDeviceLocation } from '@/src/lib/use-device-location';

type InspectionsContextValue = {
  jobs: InspectionJob[];
  pool: InspectionJob[];
  todaysJobs: InspectionJob[];
  upcomingJobs: InspectionJob[];
  overdueJobs: InspectionJob[];
  completedJobs: InspectionJob[];
  pendingJobs: InspectionJob[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  claimingId: string | null;
  receivingJobs: boolean;
  deviceLocation: GeoPoint | null;
  toggleReceivingJobs: () => void;
  refresh: () => Promise<void>;
  claim: (inspectionId: string) => Promise<InspectionJob>;
  upsertJob: (job: InspectionJob) => void;
  getJob: (id: string | undefined) => InspectionJob | undefined;
  patchJob: (id: string, patch: Partial<InspectionJob>) => void;
  getDraft: (id: string) => RoutineExecutionDraft | undefined;
  setDraft: (id: string, draft: RoutineExecutionDraft) => void;
};

const InspectionsContext = createContext<InspectionsContextValue | undefined>(
  undefined,
);

async function enrichKeys(jobs: InspectionJob[]): Promise<InspectionJob[]> {
  const pending = jobs.filter(
    (job) =>
      job.status === 'assigned' ||
      job.status === 'in_progress' ||
      job.status === 'awaiting_approval',
  );
  if (pending.length === 0) return jobs;
  const updates = await Promise.all(
    pending.map(async (job) => {
      try {
        const collection = await fetchKeyCollection(job.id);
        if (!collection) return job;
        return { ...job, keyAccess: keyAccessFromCollection(collection) };
      } catch {
        return job;
      }
    }),
  );
  const byId = new Map(updates.map((job) => [job.id, job]));
  return jobs.map((job) => byId.get(job.id) ?? job);
}

export function InspectionsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [pool, setPool] = useState<InspectionJob[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RoutineExecutionDraft>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [receivingJobs, setReceivingJobs] = useState(true);
  const deviceLocation = useDeviceLocation({
    enabled: status === 'authed',
    pingServer: receivingJobs,
  });

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [assignedDtos, poolDtos] = await Promise.all([
        fetchInspections(),
        fetchPoolInspections(),
      ]);
      const [assignedJobs, poolJobs] = await Promise.all([
        enrichKeys(mapAssignedJobs(assignedDtos)),
        Promise.resolve(mapPoolJobs(poolDtos)),
      ]);
      setJobs(assignedJobs);
      setPool(poolJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authed') return;
    void load('initial');
  }, [status, load]);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  const upsertJob = useCallback((job: InspectionJob) => {
    if (isPoolJob(job)) {
      setPool((current) => [job, ...current.filter((row) => row.id !== job.id)]);
      return;
    }
    setPool((current) => current.filter((row) => row.id !== job.id));
    setJobs((current) => [job, ...current.filter((row) => row.id !== job.id)]);
  }, []);

  const patchJob = useCallback((id: string, patch: Partial<InspectionJob>) => {
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  }, []);

  const getJob = useCallback(
    (id: string | undefined) => {
      if (!id) return undefined;
      return jobs.find((job) => job.id === id) ?? pool.find((job) => job.id === id);
    },
    [jobs, pool],
  );

  const getDraft = useCallback(
    (id: string) => drafts[id],
    [drafts],
  );

  const setDraft = useCallback((id: string, draft: RoutineExecutionDraft) => {
    setDrafts((current) => ({ ...current, [id]: draft }));
  }, []);

  const toggleReceivingJobs = useCallback(() => {
    setReceivingJobs((current) => !current);
  }, []);

  const claim = useCallback(
    async (inspectionId: string) => {
      setClaimingId(inspectionId);
      try {
        let dto: InspectorInspection = await claimInspection(inspectionId);
        try {
          dto = await acceptInspection(inspectionId);
        } catch {
          // Keep the claimed DRAFT row if accept is blocked (e.g. unpaid Level 1).
        }
        const job = toInspectionJob(dto);
        try {
          const collection = await fetchKeyCollection(job.id);
          if (collection) job.keyAccess = keyAccessFromCollection(collection);
        } catch {
          // Keys stay optional if the arrangement endpoint is unavailable.
        }
        setPool((current) => current.filter((item) => item.id !== inspectionId));
        upsertJob(job);
        return job;
      } finally {
        setClaimingId(null);
      }
    },
    [upsertJob],
  );

  const assignedCore = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status !== 'declined' &&
          job.status !== 'available' &&
          isCoreInspectionType(job.type),
      ),
    [jobs],
  );

  const pendingJobs = useMemo(
    () => assignedCore.filter((job) => job.status !== 'completed'),
    [assignedCore],
  );
  const todaysJobs = useMemo(
    () => pendingJobs.filter(isTodaysInspection).sort(byScheduleTime),
    [pendingJobs],
  );
  const upcomingJobs = useMemo(
    () => pendingJobs.filter(isUpcomingInspection).sort(byScheduleTime),
    [pendingJobs],
  );
  const overdueJobs = useMemo(
    () => pendingJobs.filter(isOverdueInspection).sort(byScheduleTime),
    [pendingJobs],
  );
  const completedJobs = useMemo(
    () =>
      assignedCore
        .filter((job) => job.status === 'completed' || job.status === 'awaiting_approval')
        .sort(
          (a, b) =>
            new Date(b.scheduledTime || b.scheduledDate).getTime() -
            new Date(a.scheduledTime || a.scheduledDate).getTime(),
        ),
    [assignedCore],
  );

  const value = useMemo(
    () => ({
      jobs,
      pool,
      todaysJobs,
      upcomingJobs,
      overdueJobs,
      completedJobs,
      pendingJobs,
      loading,
      refreshing,
      error,
      claimingId,
      receivingJobs,
      deviceLocation,
      toggleReceivingJobs,
      refresh,
      claim,
      upsertJob,
      getJob,
      patchJob,
      getDraft,
      setDraft,
    }),
    [
      jobs,
      pool,
      todaysJobs,
      upcomingJobs,
      overdueJobs,
      completedJobs,
      pendingJobs,
      loading,
      refreshing,
      error,
      claimingId,
      receivingJobs,
      deviceLocation,
      toggleReceivingJobs,
      refresh,
      claim,
      upsertJob,
      getJob,
      patchJob,
      getDraft,
      setDraft,
    ],
  );

  return (
    <InspectionsContext.Provider value={value}>{children}</InspectionsContext.Provider>
  );
}

export function useInspections(): InspectionsContextValue {
  const ctx = useContext(InspectionsContext);
  if (!ctx) {
    throw new Error('useInspections must be used inside InspectionsProvider');
  }
  return ctx;
}
