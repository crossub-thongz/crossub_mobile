import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useLedger } from '@/src/account/ledger-context';
import { INSPECTION_PAY_LABEL, ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD } from '@/src/constants/inspection';
import { formatCurrency, formatDate } from '@/src/lib/datetime';
import type { InspectionType } from '@/src/lib/types';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

const TYPE_COLOR: Record<InspectionType, string> = {
  open: '#38bdf8',
  ingoing: '#c084fc',
  outgoing: '#fb923c',
  routine: '#2dd4bf',
  tribunal: '#fb7185',
};

export default function EarningsScreen() {
  const {
    earnings,
    weeklyEarnings,
    claimedEarnings,
    unclaimedEarnings,
    loading,
    error,
    refresh,
  } = useLedger();

  return (
    <View style={styles.safe}>
      <AppHeader title="Earnings" backHref="/more" />
      <ScrollView
        contentContainerStyle={styles.inner}
        refreshControl={
          <RefreshControl
            refreshing={loading && earnings.length > 0}
            onRefresh={() => {
              void refresh();
            }}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.stats}>
          <View style={[styles.stat, styles.statWeek]}>
            <Text style={styles.statKicker}>This week</Text>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {formatCurrency(weeklyEarnings)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statKicker}>Claimed</Text>
            <Text style={[styles.statValue, { color: '#34d399' }]}>
              {formatCurrency(claimedEarnings)}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statKicker}>Unclaimed</Text>
            <Text style={[styles.statValue, { color: colors.amber }]}>
              {formatCurrency(unclaimedEarnings)}
            </Text>
          </View>
        </View>
        <Text style={styles.rate}>
          {`Routine & open: $${ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD} inc GST · Ingoing/outgoing: agent price list`}
        </Text>

        <Text style={styles.section}>Payment history</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && earnings.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : earnings.length === 0 ? (
          <EmptyState
            icon="wallet-outline"
            title="No earnings yet"
            description="Complete inspections to see payments here."
          />
        ) : (
          earnings.map((row) => (
            <View key={row.id} style={styles.row}>
              <View style={[styles.badge, { borderColor: TYPE_COLOR[row.type] }]}>
                <Text style={[styles.badgeText, { color: TYPE_COLOR[row.type] }]}>
                  {INSPECTION_PAY_LABEL[row.type]}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.address} numberOfLines={1}>
                  {row.propertyAddress}
                </Text>
                <Text style={styles.meta}>
                  {`${formatDate(row.completedAt)} · ${row.hoursWorked}h`}
                </Text>
              </View>
              <View style={styles.amountCol}>
                <Text style={styles.amount}>{formatCurrency(row.laborAmount)}</Text>
                <Text style={[styles.paid, { color: row.accountingSynced ? '#34d399' : colors.amber }]}>
                  {row.accountingSynced ? 'Paid' : 'Not paid'}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 8 },
  stats: { flexDirection: 'row', gap: 6 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  statWeek: {
    borderColor: 'rgba(0,212,164,0.3)',
    backgroundColor: 'rgba(0,212,164,0.08)',
  },
  statKicker: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statValue: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 4 },
  rate: { color: colors.muted, fontSize: 10, textAlign: 'center', marginVertical: 4 },
  section: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 8 },
  error: { color: colors.destructive, fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  address: { color: colors.text, fontSize: 12, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 10, marginTop: 2 },
  amountCol: { alignItems: 'flex-end' },
  amount: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  paid: { fontSize: 9, fontWeight: '600', marginTop: 2 },
});
