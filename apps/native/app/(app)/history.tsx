import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';
import { useRouter } from 'expo-router';

import { useAccount } from '@/src/account/account-context';
import { fetchKeyCollection } from '@/src/api/inspector';
import { INSPECTION_PAY_LABEL } from '@/src/constants/inspection';
import { useInspections } from '@/src/inspections/inspections-context';
import { formatDateTime } from '@/src/lib/datetime';
import { approvalAwaitingLabel } from '@/src/lib/inspection-job-cta';
import { historyProofLabel, historyProofPhotoCount } from '@/src/lib/job-history';
import { applyKeyCollection } from '@/src/lib/key-access';
import { jobHistory } from '@/src/lib/routes';
import type { InspectionJob } from '@/src/lib/types';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';
import { useScrollEndPadding } from '@/src/ui/use-scroll-end-padding';

function matchesHistoryQuery(job: InspectionJob, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    job.propertyAddress.toLowerCase().includes(q) || job.suburb.toLowerCase().includes(q)
  );
}

const HistoryRow = memo(function HistoryRow({
  job,
  onOpen,
}: {
  job: InspectionJob;
  onOpen: (id: string) => void;
}) {
  const { selfManaged } = useAccount();
  const proofCount = historyProofPhotoCount(job);
  return (
    <Pressable onPress={() => onOpen(job.id)} style={styles.card}>
      <View style={styles.badges}>
        <View style={styles.typeChip}>
          <Text style={styles.typeChipText}>
            {(INSPECTION_PAY_LABEL[job.type] ?? job.type).toUpperCase()}
          </Text>
        </View>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>
            {job.status === 'awaiting_approval'
              ? approvalAwaitingLabel(selfManaged).toUpperCase()
              : 'COMPLETED'}
          </Text>
        </View>
      </View>
      <Text style={styles.address}>{job.propertyAddress}</Text>
      <Text style={styles.meta}>
        {formatDateTime(job.scheduledTime || job.scheduledDate)}
        {job.approvedAt ? ` - Report ${formatDateTime(job.approvedAt)}` : ''}
      </Text>
      <Text style={styles.view}>
        View report
        {proofCount > 0 ? <Text style={styles.proof}>{historyProofLabel(proofCount)}</Text> : null}
      </Text>
    </Pressable>
  );
});

export default function HistoryScreen() {
  const router = useRouter();
  const { completedJobs, loading, refreshing, error, refresh, upsertJob } = useInspections();
  const [query, setQuery] = useState('');
  const fetchedKeys = useRef<Set<string>>(new Set());
  const scrollEndPadding = useScrollEndPadding();

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const targets = completedJobs.filter((job) => {
      if (fetchedKeys.current.has(job.id)) return false;
      return historyProofPhotoCount(job) === 0;
    });
    if (targets.length === 0) return;
    for (const job of targets) fetchedKeys.current.add(job.id);
    void (async () => {
      const batchSize = 3;
      for (let i = 0; i < targets.length; i += batchSize) {
        if (!alive.current) return;
        await Promise.all(
          targets.slice(i, i + batchSize).map(async (job) => {
            try {
              const collection = await fetchKeyCollection(job.id);
              if (!collection || !alive.current) return;
              upsertJob(applyKeyCollection(job, collection));
            } catch {
              // Keep the row. Jobs with no key photos stay at 0.
            }
          }),
        );
      }
    })();
  }, [completedJobs, upsertJob]);

  const filtered = useMemo(
    () => completedJobs.filter((job) => matchesHistoryQuery(job, query)),
    [completedJobs, query],
  );

  const openJob = useCallback(
    (id: string) => {
      router.push(jobHistory(id));
    },
    [router],
  );

  return (
    <View style={styles.safe}>
      <AppHeader title="Job history" backHref="/inspect" />
      <FlatList
        data={loading && completedJobs.length === 0 ? [] : filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HistoryRow job={item} onOpen={openJob} />}
        contentContainerStyle={[styles.inner, { paddingBottom: scrollEndPadding }]}
        keyboardShouldPersistTaps="handled"
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
            <Text style={styles.lede}>
              Completed inspections with key collection proof and uploaded section photos.
            </Text>
            <View style={styles.search}>
              <AppTextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search address or suburb"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                autoCapitalize="none"
                style={styles.searchInput}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          loading && completedJobs.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
          ) : (
            <EmptyState
              icon="document-text-outline"
              title={query.trim() ? 'No matching jobs' : 'No completed jobs yet'}
              description={
                query.trim()
                  ? 'Try a different address or suburb.'
                  : 'Finished inspections will appear here with proof photos and key records.'
              }
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, gap: 12 },
  header: { gap: 12 },
  lede: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
  },
  searchInput: {
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  error: { color: colors.destructive, fontSize: 13 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  typeChip: {
    backgroundColor: 'rgba(0,212,164,0.15)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeChipText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  statusChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusChipText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  address: { color: colors.text, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12 },
  view: { color: colors.primary, fontSize: 12, fontWeight: '700', marginTop: 4 },
  proof: { color: colors.muted, fontWeight: '400' },
});
