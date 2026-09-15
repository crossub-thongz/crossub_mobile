import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { InspectJobRow } from '@/src/inspections/inspect-job-row';
import { InspectNextCard } from '@/src/inspections/inspect-next-card';
import { useInspections } from '@/src/inspections/inspections-context';
import { jobDetail, historyPath } from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

type ScheduleTab = 'today' | 'upcoming' | 'overdue' | 'completed';

function parseTab(value: string | string[] | undefined): ScheduleTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'upcoming' || raw === 'overdue' || raw === 'completed' || raw === 'today') {
    return raw;
  }
  return 'today';
}

export default function InspectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = parseTab(params.tab);
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

  const setTab = (next: ScheduleTab) => {
    if (next === 'today') router.setParams({ tab: undefined });
    else router.setParams({ tab: next });
  };

  const nextJob = useMemo(() => {
    const now = Date.now();
    const remaining = todaysJobs.filter(
      (job) => new Date(job.scheduledTime || job.scheduledDate).getTime() >= now,
    );
    return remaining[0] ?? todaysJobs[0] ?? null;
  }, [todaysJobs]);

  const listJobs =
    tab === 'today'
      ? todaysJobs
      : tab === 'upcoming'
        ? upcomingJobs
        : tab === 'overdue'
          ? overdueJobs
          : completedJobs;
  const listWithoutHero =
    tab === 'today' && nextJob
      ? listJobs.filter((job) => job.id !== nextJob.id)
      : listJobs;

  const emptyTitle =
    tab === 'today'
      ? 'No inspections today'
      : tab === 'upcoming'
        ? 'No upcoming inspections'
        : tab === 'overdue'
          ? 'No overdue inspections'
          : 'No completed inspections';
  const emptyDescription =
    tab === 'today'
      ? 'Accepted jobs scheduled for today will show here.'
      : tab === 'upcoming'
        ? 'Jobs scheduled after today will show here.'
        : tab === 'overdue'
          ? 'Jobs that were not finished after their scheduled date will show here.'
          : 'Finished inspections will show here.';

  const heading =
    tab === 'today'
      ? `Today • ${todaysJobs.length} inspection${todaysJobs.length === 1 ? '' : 's'}`
      : tab === 'upcoming'
        ? `Upcoming • ${upcomingJobs.length} inspection${upcomingJobs.length === 1 ? '' : 's'}`
        : `Overdue • ${overdueJobs.length} inspection${overdueJobs.length === 1 ? '' : 's'}`;

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

      <ScrollView
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {tab === 'today' && nextJob ? (
          <InspectNextCard
            job={nextJob}
            origin={deviceLocation}
            onOpen={() => goJob(nextJob.id)}
            onAction={goHref}
          />
        ) : null}
        {listJobs.length === 0 ? (
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
            {tab !== 'completed' ? <Text style={styles.section}>{heading}</Text> : null}
            {(tab === 'today' ? listWithoutHero : listJobs).map((job) => (
              <InspectJobRow
                key={job.id}
                job={job}
                origin={deviceLocation}
                completed={tab === 'completed'}
                onOpen={() => goJob(job.id)}
                onAction={goHref}
              />
            ))}
          </>
        )}
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
  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 96 },
  error: { color: colors.destructive, marginBottom: 8 },
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
