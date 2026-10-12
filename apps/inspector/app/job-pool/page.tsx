'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Briefcase, ChevronRight, Route } from 'lucide-react';

import { EmptyState } from '@/components/inspector/empty-state';
import {
  JobPoolTypeTags,
  type JobPoolFilter,
} from '@/components/inspector/inspection-type-tabs';
import { JobCard } from '@/components/inspector/job-card';
import { JobPoolLocationBar } from '@/components/inspector/job-pool-location-bar';
import { InspectorShell } from '@/components/layout/inspector-shell';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { useDeviceLocation } from '@/lib/use-device-position';
import {
  CORE_INSPECTION_TYPES,
  INSPECTION_TYPE_LABEL,
  type CoreInspectionType,
} from '@/constants/inspection';
import { ROUTES } from '@/constants/routes';
import {
  inspectorLevelAllows,
  poolTypesForInspectorLevel,
} from '@/lib/inspector-access-level';
import {
  loadPoolLocationPrefs,
  POOL_SORT_LABEL,
  savePoolLocationPrefs,
  type PoolOrigin,
} from '@/lib/pool-location';
import { computeTravelEstimate } from '@/lib/travel';

function liveOrigin(
  saved: PoolOrigin | null,
  gps: { latitude: number; longitude: number } | null,
): PoolOrigin | null {
  if (saved?.source === 'custom') return saved;
  if (gps) {
    return {
      latitude: gps.latitude,
      longitude: gps.longitude,
      label: saved?.source === 'gps' ? saved.label : 'Current location',
      source: 'gps',
    };
  }
  return saved;
}

export default function JobPoolPage() {
  const {
    poolJobs,
    receivingJobs,
    loading,
    rosterLinked,
    poolError,
    refresh,
    profile,
  } = useInspectorData();
  const deviceLocation = useDeviceLocation();
  const allowedPoolTypes = useMemo(
    () => poolTypesForInspectorLevel(profile.accessLevel),
    [profile.accessLevel],
  );
  const showOpenBatch = inspectorLevelAllows(profile.accessLevel, 'open');
  const [filter, setFilter] = useState<JobPoolFilter>('all');
  const [prefs, setPrefs] = useState(loadPoolLocationPrefs);

  const origin = liveOrigin(prefs.origin, deviceLocation);

  useEffect(() => {
    savePoolLocationPrefs({ ...prefs, origin });
  }, [origin, prefs]);

  useEffect(() => {
    if (!receivingJobs) return;
    void refresh({ background: true, includePool: true });
  }, [receivingJobs, refresh]);

  useEffect(() => {
    if (filter !== 'all' && !allowedPoolTypes.includes(filter)) {
      setFilter('all');
    }
  }, [allowedPoolTypes, filter]);

  const counts = useMemo(
    () =>
      CORE_INSPECTION_TYPES.reduce(
        (acc, type) => {
          acc[type] = poolJobs.filter((j) => j.type === type).length;
          return acc;
        },
        {} as Record<CoreInspectionType, number>,
      ),
    [poolJobs],
  );

  const typedJobs = useMemo(() => {
    if (filter === 'all') return poolJobs;
    return poolJobs.filter((j) => j.type === filter);
  }, [poolJobs, filter]);

  const filteredJobs = useMemo(() => {
    const withDistance = typedJobs.map((job) => {
      const travel = computeTravelEstimate(
        origin,
        job.latitude != null && job.longitude != null
          ? { latitude: job.latitude, longitude: job.longitude }
          : null,
      );
      return { job, distanceKm: travel?.distanceKm ?? Number.POSITIVE_INFINITY };
    });
    const inRadius =
      prefs.radiusKm == null
        ? withDistance
        : withDistance.filter((row) => row.distanceKm <= (prefs.radiusKm ?? 0));
    inRadius.sort((a, b) => {
      if (prefs.sort === 'soonest') {
        return (
          new Date(a.job.scheduledTime).getTime() -
          new Date(b.job.scheduledTime).getTime()
        );
      }
      if (prefs.sort === 'newest') {
        const createdA = a.job.createdAt ?? a.job.scheduledTime;
        const createdB = b.job.createdAt ?? b.job.scheduledTime;
        return new Date(createdB).getTime() - new Date(createdA).getTime();
      }
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return (
        new Date(a.job.scheduledTime).getTime() -
        new Date(b.job.scheduledTime).getTime()
      );
    });
    return inRadius.map((row) => row.job);
  }, [origin, prefs.radiusKm, prefs.sort, typedJobs]);

  const totalAvailable = poolJobs.length;
  const showLoading = loading;
  const radiusLabel =
    prefs.radiusKm == null ? 'any distance' : `${prefs.radiusKm}km`;

  return (
    <InspectorShell title="Job Pool">
      <div className="space-y-3">
        <JobPoolLocationBar
          origin={origin}
          gps={deviceLocation}
          radiusKm={prefs.radiusKm}
          sort={prefs.sort}
          onOriginChange={(next) => setPrefs((prev) => ({ ...prev, origin: next }))}
          onRadiusChange={(radiusKm) => setPrefs((prev) => ({ ...prev, radiusKm }))}
          onSortChange={(sort) => setPrefs((prev) => ({ ...prev, sort }))}
        />

        {showOpenBatch ? (
        <Link
          href={ROUTES.OPEN_BATCH}
          className="border-border bg-card hover:border-primary/40 flex items-center gap-3 rounded-xl border p-3 transition-colors"
        >
          <div className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Route className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Open task pool</p>
            <p className="text-muted-foreground text-[11px]">
              Saturday opens are picked as a set — select yours and the route sets the
              times.
            </p>
          </div>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </Link>
        ) : null}

        <JobPoolTypeTags
          active={filter}
          onChange={setFilter}
          counts={counts}
          types={allowedPoolTypes}
        />

        {!receivingJobs ? (
          <EmptyState
            icon={Briefcase}
            title="You're on break"
            description="Tap the red bubble above the footer to start receiving open inspection jobs from the pool."
          />
        ) : !showLoading && !rosterLinked ? (
          <EmptyState
            icon={Briefcase}
            title="Roster not approved yet"
            description="Complete your registration in Profile and ask ops to approve your inspector roster. Pool jobs appear here once you're on the live roster."
          />
        ) : poolError ? (
          <EmptyState
            icon={Briefcase}
            title="Could not load the pool"
            description={poolError}
          />
        ) : showLoading && totalAvailable === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="Loading jobs…"
            description="Fetching the latest pool listings."
          />
        ) : totalAvailable === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs available"
            description="Check back later — new jobs are posted throughout the day."
          />
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={
              filter === 'all'
                ? 'No jobs in this area'
                : `No ${INSPECTION_TYPE_LABEL[filter]} jobs`
            }
            description={`Nothing within ${radiusLabel}. Widen the radius or set another location.`}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'}{' '}
                  within {radiusLabel}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Sorted by {POOL_SORT_LABEL[prefs.sort]}
                </p>
              </div>
            </div>
            {filteredJobs.map((job) => (
              <JobCard key={job.id} job={job} showActions origin={origin} />
            ))}
          </div>
        )}
      </div>
    </InspectorShell>
  );
}
