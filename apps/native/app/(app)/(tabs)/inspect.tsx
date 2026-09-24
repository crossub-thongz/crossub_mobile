import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { InspectJobRow } from '@/src/inspections/inspect-job-row';
import { InspectNextCard } from '@/src/inspections/inspect-next-card';
import { useInspections } from '@/src/inspections/inspections-context';
import { jobDetail, historyPath } from '@/src/lib/routes';
import type { GeoPoint } from '@/src/lib/travel';
import type { InspectionJob } from '@/src/lib/types';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

const SCHEDULE_TABS = ['today', 'upcoming', 'overdue'] as const;
type ScheduleTab = (typeof SCHEDULE_TABS)[number] | 'completed';

function parseTab(value: string | string[] | undefined): ScheduleTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'upcoming' || raw === 'overdue' || raw === 'completed' || raw === 'today') {
    return raw;
  }
  return 'today';
}

function InspectPage({
  jobs,
  nextJob,
  origin,
  loading,
  emptyTitle,
  emptyDescription,
  heading,
  completed,
  onOpen,
  onAction,
}: {
  jobs: InspectionJob[];
  nextJob?: InspectionJob | null;
  origin?: GeoPoint | null;
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  heading: string;
  completed?: boolean;
  onOpen: (id: string) => void;
  onAction: (href: string) => void;
}) {
  const listWithoutHero = nextJob ? jobs.filter((job) => job.id !== nextJob.id) : jobs;

  return (
    <View style={styles.page}>
      {nextJob ? (
        <InspectNextCard
          job={nextJob}
          origin={origin}
          onOpen={() => onOpen(nextJob.id)}
          onAction={onAction}
        />
      ) : null}
      {jobs.length === 0 ? (
        loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <EmptyState
            icon="clipboard-outline"
            title={emptyTitle}
            description={emptyDescription}
          />
        )
      ) : (
        <>
          {!completed ? <Text style={styles.section}>{heading}</Text> : null}
          {(nextJob ? listWithoutHero : jobs).map((job) => (
            <InspectJobRow
              key={job.id}
              job={job}
              origin={origin}
              completed={completed}
              onOpen={() => onOpen(job.id)}
              onAction={onAction}
            />
          ))}
        </>
      )}
    </View>
  );
}

export default function InspectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = parseTab(params.tab);
  const pagerRef = useRef<ScrollView>(null);
  const skipPagerSync = useRef(false);
  const { width } = useWindowDimensions();
  const {
    todaysJobs,
    upcomingJobs,
    overdueJobs,
    completedJobs,
    pendingJobs,
    loading,
    refreshing,
    error,
    deviceLocation,
    refresh,
  } = useInspections();

  useEffect(() => {
    if (tab === 'completed') router.replace(historyPath as never);
  }, [tab, router]);

  const scheduleIndex = Math.max(
    0,
    SCHEDULE_TABS.indexOf(tab === 'completed' ? 'today' : tab),
  );

  useEffect(() => {
    if (skipPagerSync.current) {
      skipPagerSync.current = false;
      return;
    }
    pagerRef.current?.scrollTo({ x: scheduleIndex * width, animated: true });
  }, [scheduleIndex, width]);

  const setTab = (next: ScheduleTab) => {
    if (next === 'today') router.setParams({ tab: undefined });
    else router.setParams({ tab: next });
  };

  const onPagerScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
    const next = SCHEDULE_TABS[nextIndex];
    if (!next || next === tab) return;
    skipPagerSync.current = true;
    setTab(next);
  };

  const nextJob = useMemo(() => {
    const now = Date.now();
    const remaining = todaysJobs.filter(
      (job) => new Date(job.scheduledTime || job.scheduledDate).getTime() >= now,
    );
    return remaining[0] ?? todaysJobs[0] ?? null;
  }, [todaysJobs]);

  const goJob = (id: string) => router.push(jobDetail(id) as never);
  const goHref = (href: string) => router.push(href as never);

  return (
    <View style={styles.safe}>
      <AppHeader variant="workspace" title="My Inspections" />
      <View style={styles.tabs}>
        {(
          [
            { id: 'today' as const, label: 'Today', count: todaysJobs.length },
            { id: 'upcoming' as const, label: 'Upcoming', count: upcomingJobs.length },
            { id: 'overdue' as const, label: 'Overdue', count: overdueJobs.length },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setTab(item.id)}
            style={[styles.tab, tab === item.id && styles.tabOn]}
          >
            <Text style={[styles.tabLabel, tab === item.id && styles.tabLabelOn]}>
              {item.label}
            </Text>
            <View style={[styles.count, tab === item.id && styles.countOn]}>
              <Text style={[styles.countText, tab === item.id && styles.countTextOn]}>
                {item.count}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScrollEnd}
        onScrollEndDrag={onPagerScrollEnd}
        decelerationRate="fast"
        style={styles.pager}
        contentOffset={{ x: scheduleIndex * width, y: 0 }}
      >
        <ScrollView
          style={{ width }}
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
        >
          <InspectPage
            jobs={todaysJobs}
            nextJob={nextJob}
            origin={deviceLocation}
            loading={loading}
            emptyTitle="No inspections today"
            emptyDescription="Accepted jobs scheduled for today will show here."
            heading={`Today - ${todaysJobs.length} inspection${todaysJobs.length === 1 ? '' : 's'}`}
            onOpen={goJob}
            onAction={goHref}
          />
        </ScrollView>
        <ScrollView
          style={{ width }}
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
        >
          <InspectPage
            jobs={upcomingJobs}
            origin={deviceLocation}
            loading={loading}
            emptyTitle="No upcoming inspections"
            emptyDescription="Jobs scheduled after today will show here."
            heading={`Upcoming - ${upcomingJobs.length} inspection${upcomingJobs.length === 1 ? '' : 's'}`}
            onOpen={goJob}
            onAction={goHref}
          />
        </ScrollView>
        <ScrollView
          style={{ width }}
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
        >
          <InspectPage
            jobs={overdueJobs}
            origin={deviceLocation}
            loading={loading}
            emptyTitle="No overdue inspections"
            emptyDescription="Jobs that were not finished after their scheduled date will show here."
            heading={`Overdue - ${overdueJobs.length} inspection${overdueJobs.length === 1 ? '' : 's'}`}
            onOpen={goJob}
            onAction={goHref}
          />
        </ScrollView>
      </ScrollView>

      <View style={styles.float}>
        <Pressable
          onPress={() => {
            if (tab === 'completed') setTab('today');
          }}
          style={[styles.floatBtn, tab !== 'completed' && styles.floatOn]}
        >
          <Text style={[styles.floatText, tab !== 'completed' && styles.floatTextOn]}>
            Active ({pendingJobs.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(historyPath as never)}
          style={styles.floatBtn}
        >
          <Text style={styles.floatText}>
            Completed ({completedJobs.length})
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  tabs: { flexDirection: 'row', paddingHorizontal: 4 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabOn: { borderBottomColor: colors.primary },
  tabLabel: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  tabLabelOn: { color: colors.primary },
  count: {
    backgroundColor: colors.secondary,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  countOn: { backgroundColor: colors.primary },
  countText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  countTextOn: { color: colors.primaryFg },
  pager: { flex: 1 },
  page: { paddingHorizontal: 16 },
  list: { paddingTop: 12, paddingBottom: 96, flexGrow: 1 },
  error: {
    color: colors.destructive,
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  section: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  float: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    flexDirection: 'row',
    backgroundColor: colors.secondary,
    borderRadius: 999,
    padding: 4,
  },
  floatBtn: { flex: 1, borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  floatOn: { backgroundColor: colors.primary },
  floatText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  floatTextOn: { color: colors.primaryFg },
});
