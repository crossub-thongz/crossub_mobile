import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { INSPECTION_PAY_LABEL } from '@/src/constants/inspection';
import { useInspections } from '@/src/inspections/inspections-context';
import { formatDateTime } from '@/src/lib/datetime';
import { jobHistory } from '@/src/lib/routes';
import type { InspectionJob } from '@/src/lib/types';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

function matchesHistoryQuery(job: InspectionJob, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    job.propertyAddress.toLowerCase().includes(q) || job.suburb.toLowerCase().includes(q)
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { completedJobs, loading, refreshing, error, refresh } = useInspections();
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => completedJobs.filter((job) => matchesHistoryQuery(job, query)),
    [completedJobs, query],
  );

  return (
    <View style={styles.safe}>
      <AppHeader title="Job history" backHref="/" />
      <ScrollView
        contentContainerStyle={styles.inner}
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
      >
        <Text style={styles.lede}>
          Completed inspections with key collection proof and uploaded section photos.
        </Text>
        <View style={styles.search}>
          <TextInput
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
        {loading && completedJobs.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="document-text-outline"
            title={query.trim() ? 'No matching jobs' : 'No completed jobs yet'}
            description={
              query.trim()
                ? 'Try a different address or suburb.'
                : 'Finished inspections will appear here with proof photos and key records.'
            }
          />
        ) : (
          filtered.map((job) => (
            <Pressable
              key={job.id}
              onPress={() => router.push(jobHistory(job.id))}
              style={styles.card}
            >
              <View style={styles.badges}>
                <View style={styles.typeChip}>
                  <Text style={styles.typeChipText}>
                    {(INSPECTION_PAY_LABEL[job.type] ?? job.type).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.statusChip}>
                  <Text style={styles.statusChipText}>
                    {job.status === 'awaiting_approval' ? 'PENDING APPROVAL' : 'COMPLETED'}
                  </Text>
                </View>
              </View>
              <Text style={styles.address}>{job.propertyAddress}</Text>
              <Text style={styles.meta}>
                {formatDateTime(job.scheduledTime || job.scheduledDate)}
                {job.approvedAt ? ` - Report ${formatDateTime(job.approvedAt)}` : ''}
              </Text>
              <Text style={styles.view}>View report</Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 12 },
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
});
