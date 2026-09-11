import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { PoolJobCard } from '@/src/inspections/pool-job-card';
import { POOL_SORT_LABEL, PoolLocationBar } from '@/src/inspections/pool-location-bar';
import { useAccount } from '@/src/account/account-context';
import { useInspections } from '@/src/inspections/inspections-context';
import {
  CORE_INSPECTION_TYPES,
  INSPECTION_TYPE_LABEL,
  type CoreInspectionType,
} from '@/src/constants/inspection';
import {
  DEFAULT_POOL_PREFS,
  liveOrigin,
  loadPoolLocationPrefs,
  savePoolLocationPrefs,
  type PoolLocationPrefs,
} from '@/src/lib/pool-location';
import { jobDetail, openBatchPath } from '@/src/lib/routes';
import { inspectorLevelAllows } from '@/src/lib/inspector-access-level';
import { computeTravelEstimate, jobDestination } from '@/src/lib/travel';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

type PoolFilter = 'all' | CoreInspectionType;

export default function PoolScreen() {
  const router = useRouter();
  const { accessLevel } = useAccount();
  const {
    pool,
    loading,
    refreshing,
    error,
    claimingId,
    receivingJobs,
    deviceLocation,
    refresh,
    claim,
  } = useInspections();
  const [typeFilter, setTypeFilter] = useState<PoolFilter>('all');
  const [prefs, setPrefs] = useState<PoolLocationPrefs>(DEFAULT_POOL_PREFS);
  const [prefsReady, setPrefsReady] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const origin = useMemo(
    () => liveOrigin(prefs.origin, deviceLocation),
    [deviceLocation, prefs.origin],
  );
  const radiusKm = prefs.radiusKm;
  const sort = prefs.sort;

  useEffect(() => {
    void loadPoolLocationPrefs().then((next) => {
      setPrefs(next);
      setPrefsReady(true);
    });
  }, []);

  useEffect(() => {
    if (!prefsReady) return;
    void savePoolLocationPrefs({ ...prefs, origin });
  }, [origin, prefs, prefsReady]);

  const counts = useMemo(
    () =>
      CORE_INSPECTION_TYPES.reduce(
        (acc, type) => {
          acc[type] = pool.filter((job) => job.type === type).length;
          return acc;
        },
        {} as Record<CoreInspectionType, number>,
      ),
    [pool],
  );

  const rows = useMemo(() => {
    const typed = typeFilter === 'all' ? pool : pool.filter((job) => job.type === typeFilter);
    const withDistance = typed.map((job) => {
      const travel = computeTravelEstimate(origin, jobDestination(job));
      return { job, distanceKm: travel?.distanceKm ?? Number.POSITIVE_INFINITY };
    });
    const inRadius =
      origin == null || radiusKm == null
        ? withDistance
        : withDistance.filter((row) => row.distanceKm <= radiusKm);
    inRadius.sort((a, b) => {
      if (sort === 'soonest') {
        return (
          new Date(a.job.scheduledTime).getTime() - new Date(b.job.scheduledTime).getTime()
        );
      }
      if (sort === 'newest') {
        const createdA = a.job.createdAt ?? a.job.scheduledTime;
        const createdB = b.job.createdAt ?? b.job.scheduledTime;
        return new Date(createdB).getTime() - new Date(createdA).getTime();
      }
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return (
        new Date(a.job.scheduledTime).getTime() - new Date(b.job.scheduledTime).getTime()
      );
    });
    return inRadius.map((row) => row.job);
  }, [origin, pool, radiusKm, sort, typeFilter]);

  const radiusLabel = radiusKm == null ? 'any distance' : `${radiusKm}km`;
  const tags: { id: PoolFilter; label: string; count: number }[] = [
    { id: 'all', label: 'ALL', count: pool.length },
    ...CORE_INSPECTION_TYPES.map((type) => ({
      id: type,
      label: INSPECTION_TYPE_LABEL[type],
      count: counts[type],
    })),
  ];

  const onAccept = async (id: string) => {
    if (!receivingJobs) return;
    setClaimError(null);
    try {
      const job = await claim(id);
      if (job.awaitingAgentPayment) {
        Alert.alert(
          'Job accepted',
          'Waiting for the agency to pay before you can start.',
        );
        router.push(jobDetail(job.id));
        return;
      }
      Alert.alert('Job accepted', 'This job is now on My Inspections.', [
        { text: 'Stay here' },
        { text: 'Open job', onPress: () => router.push(jobDetail(job.id)) },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not accept this job.';
      setClaimError(message);
      Alert.alert('Could not accept', message);
    }
  };

  let empty: ReactNode = null;
  if (!receivingJobs) {
    empty = (
      <EmptyState
        icon="briefcase-outline"
        title="You're on break"
        description="Tap the red bubble in the header to start receiving open inspection jobs from the pool."
      />
    );
  } else if (error || claimError) {
    empty = (
      <EmptyState
        icon="briefcase-outline"
        title="Could not load the pool"
        description={claimError || error || 'Try again in a moment.'}
      />
    );
  } else if (loading && pool.length === 0) {
    empty = (
      <EmptyState
        icon="briefcase-outline"
        title="Loading jobs…"
        description="Fetching the latest pool listings."
      />
    );
  } else if (pool.length === 0) {
    empty = (
      <EmptyState
        icon="briefcase-outline"
        title="No jobs available"
        description="Check back later — new jobs are posted throughout the day."
      />
    );
  } else if (rows.length === 0) {
    empty = (
      <EmptyState
        icon="briefcase-outline"
        title={
          typeFilter === 'all'
            ? 'No jobs in this area'
            : `No ${INSPECTION_TYPE_LABEL[typeFilter]} jobs`
        }
        description={`Nothing within ${radiusLabel}. Widen the radius or set another location.`}
      />
    );
  }

  return (
    <View style={styles.safe}>
      <AppHeader title="Job Pool" />
      <FlatList
        data={receivingJobs ? rows : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refresh();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <PoolLocationBar
              origin={origin}
              gps={deviceLocation}
              radiusKm={radiusKm}
              sort={sort}
              onOriginChange={(next) => setPrefs((prev) => ({ ...prev, origin: next }))}
              onRadiusChange={(next) => setPrefs((prev) => ({ ...prev, radiusKm: next }))}
              onSortChange={(next) => setPrefs((prev) => ({ ...prev, sort: next }))}
            />
            {inspectorLevelAllows(accessLevel, 'open') ? (
            <Pressable
              onPress={() => router.push(openBatchPath)}
              style={styles.openBatch}
            >
              <View style={styles.openIcon}>
                <Ionicons name="git-branch-outline" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.openTitle}>Open task pool</Text>
                <Text style={styles.openSub}>
                  Saturday opens are picked as a set — select yours and the route sets the times.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tags}>
              {tags.map((tag) => {
                const selected = typeFilter === tag.id;
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => setTypeFilter(tag.id)}
                    style={[styles.tag, selected && styles.tagOn]}
                  >
                    <Text style={[styles.tagText, selected && styles.tagTextOn]}>{tag.label}</Text>
                    <View style={[styles.count, selected && styles.countOn]}>
                      <Text style={[styles.countText, selected && styles.countTextOn]}>{tag.count}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            {receivingJobs && rows.length > 0 ? (
              <View>
                <Text style={styles.resultTitle}>
                  {rows.length} job{rows.length === 1 ? '' : 's'} within {radiusLabel}
                </Text>
                <Text style={styles.resultSub}>Sorted by {POOL_SORT_LABEL[sort]}</Text>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading && pool.length === 0 && receivingJobs ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            empty
          )
        }
        renderItem={({ item }) => (
          <PoolJobCard
            job={item}
            origin={origin}
            busy={claimingId === item.id}
            receiving={receivingJobs}
            onAccept={() => {
              void onAccept(item.id);
            }}
            onDetails={() => router.push(jobDetail(item.id))}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  header: { gap: 12, paddingBottom: 12 },
  openBatch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
  },
  openIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openTitle: { color: colors.text, fontSize: 14, fontWeight: '500' },
  openSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  tags: { gap: 8, paddingRight: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(28,35,38,0.8)',
    backgroundColor: 'rgba(28,35,38,0.4)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tagText: { color: colors.text, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  tagTextOn: { color: colors.primaryFg },
  count: {
    backgroundColor: 'rgba(11,15,16,0.6)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countOn: { backgroundColor: 'rgba(11,15,16,0.2)' },
  countText: { color: colors.muted, fontSize: 9, fontWeight: '600' },
  countTextOn: { color: colors.primaryFg },
  resultTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  resultSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
