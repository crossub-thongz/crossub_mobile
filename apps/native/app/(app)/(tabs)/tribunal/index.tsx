import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAccount } from '@/src/account/account-context';
import { fetchInspectorTribunalCases } from '@/src/api/inspector';
import { formatDate } from '@/src/lib/datetime';
import { inspectorLevelAllows } from '@/src/lib/inspector-access-level';
import { tribunalDetailPath } from '@/src/lib/routes';
import { toTribunalHearing, type TribunalHearing } from '@/src/lib/tribunal';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

export default function TribunalListScreen() {
  const router = useRouter();
  const { accessLevel } = useAccount();
  const allowed = inspectorLevelAllows(accessLevel, 'tribunal');
  const [hearings, setHearings] = useState<TribunalHearing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = (await fetchInspectorTribunalCases()).map(toTribunalHearing);
      rows.sort((a, b) => {
        if (a.closed !== b.closed) return a.closed ? 1 : -1;
        return (b.hearingDate || '').localeCompare(a.hearingDate || '');
      });
      setHearings(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tribunal cases.');
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    if (!allowed) {
      router.replace('/');
      return;
    }
    void load();
  }, [allowed, load, router]);

  if (!allowed) return null;

  return (
    <View style={styles.safe}>
      <AppHeader title="Tribunal" />
      <ScrollView
        contentContainerStyle={styles.inner}
        refreshControl={
          <RefreshControl
            refreshing={loading && hearings.length > 0}
            onRefresh={() => {
              void load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && hearings.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : hearings.length === 0 ? (
          <EmptyState
            icon="scale-outline"
            title="No hearings assigned"
            description="Tribunal hearings and evidence packages assigned to you will appear here."
          />
        ) : (
          hearings.map((hearing) => (
            <Pressable
              key={hearing.id}
              onPress={() => router.push(tribunalDetailPath(hearing.id))}
              style={styles.card}
            >
              <View style={styles.top}>
                <Text style={styles.type}>{hearing.tribunalType}</Text>
                <Text style={[styles.status, hearing.closed && styles.statusDone]}>
                  {hearing.statusLabel}
                </Text>
              </View>
              <Text style={styles.address}>{hearing.propertyAddress}</Text>
              <Text style={styles.summary}>{hearing.caseSummary}</Text>
              <Text style={styles.meta}>
                {hearing.hearingDate
                  ? `${formatDate(hearing.hearingDate)}${hearing.hearingTime ? ` · ${hearing.hearingTime}` : ''}`
                  : 'Hearing date TBA'}
                {` · ${hearing.location}`}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 10 },
  error: { color: colors.destructive, fontSize: 12 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  type: { color: '#fb7185', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  status: { color: colors.amber, fontSize: 10, fontWeight: '700' },
  statusDone: { color: colors.primary },
  address: { color: colors.text, fontSize: 15, fontWeight: '600' },
  summary: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 4 },
});
