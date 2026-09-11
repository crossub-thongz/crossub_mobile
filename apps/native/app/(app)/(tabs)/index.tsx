import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useInspections } from '@/src/inspections/inspections-context';
import { INSPECTION_PAY_LABEL } from '@/src/constants/inspection';
import {
  jobInspectionStarted,
  jobPrimaryAction,
} from '@/src/lib/inspection-job-cta';
import { formatInspectTime, formatShortDate } from '@/src/lib/datetime';
import { jobDetail } from '@/src/lib/routes';
import type { InspectionJob } from '@/src/lib/types';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

function DashboardRow({
  job,
  last,
  onAction,
  onDetails,
}: {
  job: InspectionJob;
  last?: boolean;
  onAction: (href: string) => void;
  onDetails: () => void;
}) {
  const { getDraft } = useInspections();
  const action = jobPrimaryAction(job, jobInspectionStarted(job, getDraft(job.id)));
  const agent = job.agentCompany || job.agentName || '—';
  return (
    <View style={[styles.dashRow, last && styles.dashRowLast]}>
      <View style={styles.dashTime}>
        <Text style={styles.dashTimeText}>{formatInspectTime(job.scheduledTime)}</Text>
        <Text style={styles.dashDate}>{formatShortDate(job.scheduledDate || job.scheduledTime)}</Text>
      </View>
      <View style={styles.dashBar} />
      <View style={styles.dashBody}>
        <Text style={styles.dashStreet} numberOfLines={1}>
          {job.propertyAddress}
        </Text>
        <Text style={styles.dashType}>{INSPECTION_PAY_LABEL[job.type]} Inspection</Text>
        <View style={styles.agentRow}>
          <Ionicons name="person-outline" size={12} color={colors.muted} />
          <Text style={styles.dashAgent} numberOfLines={1}>
            Agent: {agent}
          </Text>
        </View>
      </View>
      <Pressable
        disabled={action.disabled}
        onPress={() => {
          if (!action.disabled) onAction(action.href);
        }}
        style={[styles.pill, action.disabled && styles.pillDisabled]}
      >
        <Text style={[styles.pillText, action.disabled && styles.pillTextMuted]}>
          {action.label}
          {!action.disabled ? ' ›' : ''}
        </Text>
      </Pressable>
      <Pressable onPress={onDetails} hitSlop={8} style={styles.moreBtn}>
        <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const { todaysJobs, upcomingJobs, overdueJobs, refreshing, error, refresh } =
    useInspections();
  const router = useRouter();
  const list = [...todaysJobs];
  const go = (href: string) => router.push(href as never);

  return (
    <View style={styles.safe}>
      <AppHeader variant="home" />
      <ScrollView
        contentContainerStyle={styles.inner}
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

        <View style={styles.glance}>
          <Pressable onPress={() => router.push('/inspect')} style={styles.glanceCard}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} style={styles.glanceIcon} />
            <Text style={[styles.glanceValue, { color: colors.primary }]}>{todaysJobs.length}</Text>
            <Text style={styles.glanceLabel}>Today Inspections</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/inspect?tab=upcoming' as never)}
            style={styles.glanceCard}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.blue} style={styles.glanceIcon} />
            <Text style={[styles.glanceValue, { color: colors.blue }]}>{upcomingJobs.length}</Text>
            <Text style={styles.glanceLabel}>Upcoming Inspections</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/inspect?tab=overdue' as never)}
            style={styles.glanceCard}
          >
            <Ionicons name="alert-circle-outline" size={16} color={colors.red} style={styles.glanceIcon} />
            <Text style={[styles.glanceValue, { color: colors.red }]}>{overdueJobs.length}</Text>
            <Text style={styles.glanceLabel}>Overdue Inspections</Text>
          </Pressable>
        </View>

        <View style={styles.todayCard}>
          <View style={styles.todayHead}>
            <Text style={styles.todayTitle}>Today's Inspections</Text>
            <Pressable onPress={() => router.push('/inspect')}>
              <Text style={styles.viewAll}>View all</Text>
            </Pressable>
          </View>
          {list.length === 0 ? (
            <Text style={styles.empty}>No inspections scheduled for today.</Text>
          ) : (
            list.map((job, index) => (
              <DashboardRow
                key={job.id}
                job={job}
                last={index === list.length - 1}
                onAction={go}
                onDetails={() => router.push(jobDetail(job.id))}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 16 },
  error: { color: colors.destructive },
  glance: { flexDirection: 'row', gap: 8 },
  glanceCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  glanceIcon: { position: 'absolute', top: 10, right: 10 },
  glanceValue: { fontSize: 28, fontWeight: '700', lineHeight: 28 },
  glanceLabel: { color: colors.muted, fontSize: 11, marginTop: 8, lineHeight: 14 },
  todayCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  todayHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  todayTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  viewAll: { color: colors.primary, fontSize: 12, fontWeight: '500' },
  empty: { color: colors.muted, textAlign: 'center', fontSize: 12, paddingVertical: 24 },
  dashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  dashRowLast: { borderBottomWidth: 0 },
  dashTime: { width: 68 },
  dashTimeText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  dashDate: { color: colors.muted, fontSize: 11, marginTop: 2 },
  dashBar: { width: 2, alignSelf: 'stretch', backgroundColor: colors.primary, borderRadius: 99 },
  dashBody: { flex: 1, minWidth: 0 },
  dashStreet: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dashType: { color: colors.muted, fontSize: 12, marginTop: 2 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  dashAgent: { color: colors.muted, fontSize: 11, flex: 1 },
  pill: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    height: 32,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  pillDisabled: { borderColor: colors.border },
  pillText: { color: colors.primary, fontSize: 11, fontWeight: '500' },
  pillTextMuted: { color: colors.muted },
  moreBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
