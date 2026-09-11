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

const TYPE_ICON: Record<InspectionJob['type'], keyof typeof Ionicons.glyphMap> = {
  routine: 'home-outline',
  open: 'people-outline',
  ingoing: 'people-outline',
  outgoing: 'exit-outline',
  tribunal: 'home-outline',
};

export function InspectJobRow({
  job,
  completed,
  origin,
  onOpen,
  onAction,
}: {
  job: InspectionJob;
  completed?: boolean;
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

  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} style={styles.row}>
        <View style={styles.timeCol}>
          <Text style={[styles.time, { color: visual.text }]}>
            {formatInspectTime(job.scheduledTime || job.scheduledDate)}
          </Text>
        </View>
        <View style={[styles.bar, { backgroundColor: visual.bar }]} />
        <View style={styles.typeCol}>
          <Ionicons name={TYPE_ICON[job.type]} size={16} color={visual.text} />
          <Text style={[styles.typeLabel, { color: visual.text }]}>{typeLabel}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.street} numberOfLines={1}>
            {street}
          </Text>
          {locality ? (
            <Text style={styles.locality} numberOfLines={1}>
              {locality}
            </Text>
          ) : null}
        </View>
        <View style={styles.metaCol}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color={colors.muted} />
            <Text style={styles.meta}>{formatInspectDuration(job.estimatedHours)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="location-outline" size={12} color={colors.muted} />
            <Text style={styles.meta}>{travel ? formatDistanceKm(travel.distanceKm) : '—'}</Text>
          </View>
        </View>
      </Pressable>
      {!completed && !action.disabled ? (
        <Pressable onPress={() => onAction(action.href)} style={styles.cta}>
          {action.label === 'Re-Open' ? null : (
            <Ionicons name="play" size={12} color={colors.primaryFg} />
          )}
          <Text style={styles.ctaText}>{inspectListCtaLabel(job, action, true, draft)}</Text>
        </Pressable>
      ) : !completed && action.disabled ? (
        <View style={styles.ctaMuted}>
          <Text style={styles.ctaMutedText}>{action.label}</Text>
        </View>
      ) : null}
      <Pressable onPress={onOpen} style={styles.chevron}>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  timeCol: { width: 56 },
  time: { fontSize: 13, fontWeight: '700' },
  bar: { width: 2, alignSelf: 'stretch', borderRadius: 99 },
  typeCol: { width: 40, alignItems: 'center', gap: 2 },
  typeLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.3 },
  body: { flex: 1, minWidth: 0 },
  street: { color: colors.text, fontSize: 14, fontWeight: '600' },
  locality: { color: colors.muted, fontSize: 11, marginTop: 2 },
  metaCol: { alignItems: 'flex-end', gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { color: colors.muted, fontSize: 11 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    height: 28,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: { color: colors.primaryFg, fontSize: 11, fontWeight: '700' },
  ctaMuted: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    height: 28,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  ctaMutedText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  chevron: { paddingLeft: 4, paddingVertical: 8, alignSelf: 'stretch', justifyContent: 'center' },
});
