import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAccount } from '@/src/account/account-context';
import { fetchInspectorTribunalCase } from '@/src/api/inspector';
import { formatCurrency, formatDate } from '@/src/lib/datetime';
import { inspectorLevelAllows } from '@/src/lib/inspector-access-level';
import { tribunalPath } from '@/src/lib/routes';
import { toTribunalHearing, type TribunalHearing } from '@/src/lib/tribunal';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

function CheckRow({ label, on }: { label: string; on: boolean }) {
  return (
    <View style={styles.checkRow}>
      <View style={[styles.dot, on && styles.dotOn]} />
      <Text style={styles.checkLabel}>{label}</Text>
      <Text style={[styles.checkState, on && styles.checkOn]}>{on ? 'Yes' : 'No'}</Text>
    </View>
  );
}

export default function TribunalDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accessLevel } = useAccount();
  const allowed = inspectorLevelAllows(accessLevel, 'tribunal');
  const [hearing, setHearing] = useState<TribunalHearing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setHearing(toTribunalHearing(await fetchInspectorTribunalCase(id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this hearing.');
    } finally {
      setLoading(false);
    }
  }, [allowed, id]);

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
      <AppHeader title="Tribunal" backHref={tribunalPath} />
      <ScrollView contentContainerStyle={styles.inner}>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : error || !hearing ? (
          <EmptyState
            icon="scale-outline"
            title="Hearing not found"
            description={error ?? 'This tribunal case could not be loaded.'}
          />
        ) : (
          <>
            <Text style={styles.type}>{hearing.tribunalType}</Text>
            <Text style={styles.address}>{hearing.propertyAddress}</Text>
            <Text style={styles.meta}>
              {hearing.caseNumber}
              {hearing.suburb ? ` · ${hearing.suburb}` : ''}
            </Text>

            <View style={styles.card}>
              <Text style={styles.kicker}>Hearing</Text>
              <Text style={styles.body}>
                {hearing.hearingDate
                  ? `${formatDate(hearing.hearingDate)}${hearing.hearingTime ? ` · ${hearing.hearingTime}` : ''}`
                  : 'Date to be advised'}
              </Text>
              <Text style={styles.body}>{hearing.location}</Text>
              {hearing.hearingFormat ? (
                <Text style={styles.meta}>
                  {hearing.hearingFormat === 'online' ? 'Online' : 'In person'}
                </Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.kicker}>Case</Text>
              <Text style={styles.body}>{hearing.caseSummary}</Text>
              {hearing.outstandingRent != null ? (
                <Text style={styles.meta}>
                  Outstanding rent {formatCurrency(hearing.outstandingRent)}
                </Text>
              ) : null}
              {hearing.bondAmount != null ? (
                <Text style={styles.meta}>Bond {formatCurrency(hearing.bondAmount)}</Text>
              ) : null}
              {hearing.amountClaimed != null ? (
                <Text style={styles.meta}>
                  Amount claimed {formatCurrency(hearing.amountClaimed)}
                </Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.kicker}>Pre-hearing checklist</Text>
              <CheckRow label="Evidence complete" on={hearing.evidenceComplete} />
              <CheckRow label="Hearing confirmed" on={hearing.hearingConfirmed} />
              <CheckRow label="Attendance recorded" on={hearing.attendanceRecorded} />
            </View>

            <View style={styles.card}>
              <Text style={styles.kicker}>Evidence package</Text>
              {hearing.evidence.length === 0 ? (
                <Text style={styles.meta}>No evidence titles on this brief yet.</Text>
              ) : (
                hearing.evidence.map((item) => (
                  <View key={`${item.category}-${item.title}`} style={styles.docRow}>
                    <Text style={styles.body}>{item.title}</Text>
                    <Text style={[styles.docState, item.present && styles.checkOn]}>
                      {item.present ? 'On file' : 'Missing'}
                    </Text>
                  </View>
                ))
              )}
            </View>

            {hearing.outcomeLabel ? (
              <View style={styles.card}>
                <Text style={styles.kicker}>Outcome</Text>
                <Text style={styles.body}>{hearing.outcomeLabel}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 12 },
  type: { color: '#fb7185', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  address: { color: colors.text, fontSize: 20, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  body: { color: colors.text, fontSize: 14, lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkLabel: { color: colors.text, fontSize: 13, flex: 1 },
  checkState: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  checkOn: { color: colors.primary },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  docState: { color: colors.amber, fontSize: 11, fontWeight: '700' },
});
