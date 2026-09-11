import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { INSPECTION_TYPE_LABEL, isCoreInspectionType } from '@/src/constants/inspection';
import { useInspections } from '@/src/inspections/inspections-context';
import {
  inspectListCtaLabel,
  jobInspectionStarted,
  jobPrimaryAction,
} from '@/src/lib/inspection-job-cta';
import { formatInspectDuration, formatInspectTime } from '@/src/lib/datetime';
import { propertyAddressLines } from '@/src/lib/property-address';
import {
  computeTravelEstimate,
  formatDistanceKm,
  jobDestination,
  type GeoPoint,
} from '@/src/lib/travel';
import type { InspectionJob } from '@/src/lib/types';
import { colors, typeAccent } from '@/src/theme';

export function InspectNextCard({
  job,
  origin,
  onOpen,
  onAction,
}: {
  job: InspectionJob;
  origin?: GeoPoint | null;
  onOpen: () => void;
  onAction: (href: string) => void;
}) {
  const { getDraft } = useInspections();
  const draft = getDraft(job.id);
  const visual = typeAccent[job.type];
  const { street, locality } = propertyAddressLines(job);
  const action = jobPrimaryAction(job, jobInspectionStarted(job, draft));
  const typeLabel = isCoreInspectionType(job.type)
    ? INSPECTION_TYPE_LABEL[job.type]
    : job.type.toUpperCase();
  const travel = computeTravelEstimate(origin, jobDestination(job));
  const cta =
    action.label === 'Re-Open'
      ? 'Re-Open'
      : inspectListCtaLabel(job, action, false, draft);

  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} style={styles.top}>
        <View>
          <Text style={styles.kicker}>Next inspection</Text>
          <Text style={styles.time}>
            {formatInspectTime(job.scheduledTime || job.scheduledDate)}
          </Text>
          <Text style={styles.today}>Today</Text>
        </View>
        <View style={styles.body}>
          <View style={[styles.badge, { backgroundColor: visual.badgeBg }]}>
            <Text style={styles.badgeText}>{typeLabel}</Text>
          </View>
          <Text style={styles.street}>{street}</Text>
          {locality ? <Text style={styles.locality}>{locality}</Text> : null}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={12} color={colors.muted} />
              <Text style={styles.meta}>{formatInspectDuration(job.estimatedHours)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={colors.muted} />
              <Text style={styles.meta}>{travel ? formatDistanceKm(travel.distanceKm) : '—'}</Text>
            </View>
            {travel ? (
              <View style={styles.metaItem}>
                <Ionicons name="car-outline" size={12} color={colors.muted} />
                <Text style={styles.meta}>{travel.travelMinutes} min</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} style={{ marginTop: 4 }} />
      </Pressable>
      <View style={styles.ctaWrap}>
        <Pressable
          disabled={action.disabled}
          onPress={() => {
            if (!action.disabled) onAction(action.href);
          }}
          style={[styles.cta, action.disabled && styles.ctaDisabled]}
        >
          {action.disabled || action.label === 'Re-Open' ? null : (
            <Ionicons name="play" size={16} color={colors.primaryFg} />
          )}
          <Text style={styles.ctaText}>{cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, paddingBottom: 12 },
  kicker: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  time: { color: colors.primary, fontSize: 24, fontWeight: '700', marginTop: 4 },
  today: { color: colors.muted, fontSize: 12, marginTop: 4 },
  body: { flex: 1, minWidth: 0 },
  badge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  street: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 6 },
  locality: { color: colors.muted, fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { color: colors.muted, fontSize: 11 },
  ctaWrap: { paddingHorizontal: 16, paddingBottom: 16 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  ctaDisabled: { opacity: 0.45 },
  ctaText: { color: colors.primaryFg, fontWeight: '700' },
});
