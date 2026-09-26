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

import { apiErrorMessage } from '@/src/api/client';
import {
  acceptInspection,
  claimInspection,
  fetchInspectorProfile,
  fetchInspections,
  fetchKeyCollection,
  fetchPoolInspections,
  setInspectorPoolAvailability,
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
import { applyKeyCollection, mergeJobLocalState } from '@/src/lib/key-access';
import {
  loadAllDrafts,
  loadJobsCache,
  loadOfflineQueue,
  saveDraftLocal,
  saveJobsCache,
  subscribeDraftsChanged,
  rewriteStrings,
} from '@/src/offline/db';
import { mergeQueuedPhotosIntoDraft } from '@/src/offline/hydrate-draft-photos';
import { recoverUnsentPhotos } from '@/src/offline/recover-unsent-photos';
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
  jobsHydrated: boolean;
  refreshing: boolean;
  error: string | null;
  claimingId: string | null;
  receivingJobs: boolean;
  deviceLocation: GeoPoint | null;
  toggleReceivingJobs: () => Promise<void>;
  refresh: () => Promise<void>;
  claim: (inspectionId: string) => Promise<InspectionJob>;
  upsertJob: (job: InspectionJob) => void;
  getJob: (id: string | undefined) => InspectionJob | undefined;
  patchJob: (id: string, patch: Partial<InspectionJob>) => void;
  getDraft: (id: string) => RoutineExecutionDraft | undefined;
  setDraft: (id: string, draft: RoutineExecutionDraft) => void;
  draftsHydrated: boolean;
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
        return applyKeyCollection(job, collection);
      } catch {
        return job;
      }
    }),
  );
  const byId = new Map(updates.map((job) => [job.id, job]));
  return jobs.map((job) => byId.get(job.id) ?? job);
}

function mergePreservedJobState(
  fresh: InspectionJob[],
  previous: InspectionJob[],
): InspectionJob[] {
  const prevById = new Map(previous.map((job) => [job.id, job]));
  return fresh.map((job) => mergeJobLocalState(job, prevById.get(job.id)));
}

export function InspectionsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [jobs, setJobs] = useState<InspectionJob[]>([]);
  const [pool, setPool] = useState<InspectionJob[]>([]);
  const [drafts, setDrafts] = useState<Record<string, RoutineExecutionDraft>>({});
  const [draftsHydrated, setDraftsHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [jobsHydrated, setJobsHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [receivingJobs, setReceivingJobs] = useState(true);
  const receivingRef = useRef(receivingJobs);
  receivingRef.current = receivingJobs;
  const deviceLocation = useDeviceLocation({
    enabled: status === 'authed',
    pingServer: receivingJobs,
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await recoverUnsentPhotos().catch(() => undefined);
        const loaded = await loadAllDrafts();
        const queue = await loadOfflineQueue();
        const byJob = new Map<string, typeof queue>();
        for (const item of queue) {
          if (item.action !== 'photo_upload') continue;
          const list = byJob.get(item.jobId) ?? [];
          list.push(item);
          byJob.set(item.jobId, list);
        }
        const next: Record<string, RoutineExecutionDraft> = {};
        for (const [jobId, draft] of Object.entries(loaded)) {
          const merged = await mergeQueuedPhotosIntoDraft(draft, byJob.get(jobId) ?? []);
          next[jobId] = merged;
          if (JSON.stringify(merged) !== JSON.stringify(draft)) {
            await saveDraftLocal(jobId, merged);
          }
        }
        if (!cancelled) setDrafts(next);
      } finally {
        if (!cancelled) setDraftsHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeDraftsChanged((rewrite) => {
      if (!rewrite) return;
      setDrafts((current) => {
        const next: Record<string, RoutineExecutionDraft> = {};
        for (const [id, draft] of Object.entries(current)) {
          next[id] = rewriteStrings(draft, rewrite.from, rewrite.to) as RoutineExecutionDraft;
        }
        return next;
      });
    });
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'background', receivingOverride?: boolean) => {
    if (mode === 'initial') setLoading(true);
    else if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      let receiving = receivingOverride ?? receivingRef.current;
      if (mode === 'initial' && receivingOverride == null) {
        const profile = await fetchInspectorProfile().catch(() => null);
        receiving = profile?.roster?.receivingPoolJobs !== false;
        setReceivingJobs(receiving);
        receivingRef.current = receiving;
      }
      const [assignedDtos, poolDtos] = await Promise.all([
        fetchInspections(),
        receiving ? fetchPoolInspections() : Promise.resolve([]),
      ]);
      const [assignedJobs, poolJobs] = await Promise.all([
        enrichKeys(mapAssignedJobs(assignedDtos)),
        Promise.resolve(mapPoolJobs(poolDtos)),
      ]);
      await saveJobsCache('assigned', assignedJobs).catch(() => undefined);
      await saveJobsCache('pool', receiving ? poolJobs : []).catch(() => undefined);
      setJobs((previous) => mergePreservedJobState(assignedJobs, previous));
      setPool(receiving ? poolJobs : []);
    } catch (err) {
      const cachedAssigned = await loadJobsCache('assigned').catch(() => []);
      const cachedPool = await loadJobsCache('pool').catch(() => []);
      if (cachedAssigned.length > 0) {
        setJobs((previous) =>
          mergePreservedJobState(cachedAssigned, previous.length > 0 ? previous : cachedAssigned),
        );
      }
      if (cachedPool.length > 0 && (receivingOverride ?? receivingRef.current)) {
        setPool(cachedPool);
      }
      setError(apiErrorMessage(err, 'Could not load inspections.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
      setJobsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authed') {
      setJobsHydrated(false);
      return;
    }
    void (async () => {
      const cached = await loadJobsCache('assigned').catch(() => []);
      if (cached.length > 0) {
        setJobs((previous) => (previous.length > 0 ? previous : cached));
        setJobsHydrated(true);
      }
      await load('initial');
    })();
  }, [status, load]);

  useEffect(() => {
    if (status !== 'authed') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void load('background');
    });
    return () => sub.remove();
  }, [status, load]);

  useEffect(() => {
    if (status !== 'authed' || !receivingJobs) return;
    let busy = false;
    const timer = setInterval(() => {
      if (busy || !receivingRef.current) return;
      busy = true;
      void (async () => {
        try {
          const poolDtos = await fetchPoolInspections();
          if (!receivingRef.current) return;
          setPool(mapPoolJobs(poolDtos));
        } catch {
          // Keep the last pool snapshot.
        } finally {
          busy = false;
        }
      })();
    }, 15_000);
    return () => clearInterval(timer);
  }, [status, receivingJobs]);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  const upsertJob = useCallback((job: InspectionJob) => {
    if (isPoolJob(job)) {
      setPool((current) => [job, ...current.filter((row) => row.id !== job.id)]);
      return;
    }
    setPool((current) => current.filter((row) => row.id !== job.id));
    setJobs((current) => {
      const previous = current.find((row) => row.id === job.id);
      const merged = mergeJobLocalState(job, previous);
      return [merged, ...current.filter((row) => row.id !== job.id)];
    });
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
    void saveDraftLocal(id, draft);
  }, []);

  const toggleReceivingJobs = useCallback(async () => {
    const next = !receivingRef.current;
    setReceivingJobs(next);
    receivingRef.current = next;
    try {
      await setInspectorPoolAvailability(next);
      if (next) await load('refresh', true);
      else setPool([]);
    } catch (err) {
      setReceivingJobs(!next);
      receivingRef.current = !next;
      setError(apiErrorMessage(err, 'Could not sync availability.'));
    }
  }, [load]);

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
        let job = toInspectionJob(dto);
        try {
          const collection = await fetchKeyCollection(job.id);
          if (collection) job = applyKeyCollection(job, collection);
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
        .filter((job) => job.status === 'completed')
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
      jobsHydrated,
      draftsHydrated,
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
      jobsHydrated,
      draftsHydrated,
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
