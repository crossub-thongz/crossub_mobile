import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { INSPECTION_TYPE_LABEL, isCoreInspectionType } from '@/src/constants/inspection';
import { formatCurrency, formatDate, formatInspectTime } from '@/src/lib/datetime';
import { isPoolJob } from '@/src/lib/inspector-job-filters';
import { propertyAddressLines } from '@/src/lib/property-address';
import {
  computeTravelEstimate,
  formatDistanceKm,
  jobDestination,
  type GeoPoint,
} from '@/src/lib/travel';
import type { InspectionJob } from '@/src/lib/types';
import { colors, poolAccent } from '@/src/theme';

const TYPE_ICON: Record<InspectionJob['type'], keyof typeof Ionicons.glyphMap> = {
  routine: 'home-outline',
  open: 'people-outline',
  ingoing: 'enter-outline',
  outgoing: 'exit-outline',
  tribunal: 'home-outline',
};

export function PoolJobCard({
  job,
  busy,
  receiving,
  origin,
  onAccept,
  onDetails,
}: {
  job: InspectionJob;
  busy?: boolean;
  receiving?: boolean;
  origin?: GeoPoint | null;
  onAccept: () => void;
  onDetails: () => void;
}) {
  const { street, locality } = propertyAddressLines(job);
  const visual = poolAccent[job.type];
  const typeLabel = isCoreInspectionType(job.type)
    ? INSPECTION_TYPE_LABEL[job.type]
    : job.type.toUpperCase();
  const travel = computeTravelEstimate(origin, jobDestination(job));
  const showActions = isPoolJob(job);
  const acceptDisabled = busy || receiving === false;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.tile, { borderColor: visual.tileBorder, backgroundColor: visual.tileBg }]}>
          <Ionicons name={TYPE_ICON[job.type]} size={24} color={visual.text} />
          <Text style={[styles.tileLabel, { color: visual.text }]}>{typeLabel}</Text>
        </View>
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.street}>{street}</Text>
              {locality ? <Text style={styles.locality}>{locality}</Text> : null}
            </View>
            <View style={styles.feeCol}>
              <Text style={[styles.fee, { color: visual.text }]}>
                {formatCurrency(job.laborAmount)}
              </Text>
              <Text style={styles.feeLabel}>Est. Fee</Text>
            </View>
          </View>
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={12} color={colors.muted} />
              <Text style={styles.meta}>{formatDate(job.scheduledDate || job.scheduledTime)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={12} color={colors.muted} />
              <Text style={styles.meta}>{travel ? formatDistanceKm(travel.distanceKm) : '—'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={12} color={colors.muted} />
              <Text style={styles.meta}>{formatInspectTime(job.scheduledTime)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="car-outline" size={12} color={colors.muted} />
              <Text style={styles.meta}>
                {travel ? `${travel.travelMinutes} min away` : '—'}
              </Text>
            </View>
            <View style={[styles.metaItem, styles.metaFull]}>
              <Ionicons name="time-outline" size={12} color={colors.muted} />
              <Text style={styles.meta}>{job.durationLabel}</Text>
            </View>
          </View>
        </View>
      </View>
      {showActions ? (
        <View style={styles.actions}>
          <Pressable onPress={onDetails} style={styles.details}>
            <Text style={styles.detailsText}>View Details</Text>
          </Pressable>
          <Pressable
            onPress={onAccept}
            disabled={acceptDisabled}
            style={[styles.accept, acceptDisabled && styles.disabled]}
          >
            {busy ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.acceptText}>Accept Job</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: 'rgba(28,35,38,0.8)',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  top: { flexDirection: 'row', gap: 12 },
  tile: {
    width: 68,
    height: 68,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { marginTop: 4, fontSize: 9, fontWeight: '700', letterSpacing: 0.4 },
  body: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', gap: 8 },
  street: { color: colors.text, fontSize: 14, fontWeight: '600' },
  locality: { color: colors.muted, fontSize: 12, marginTop: 2 },
  feeCol: { alignItems: 'flex-end' },
  fee: { fontSize: 18, fontWeight: '700' },
  feeLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metaGrid: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaFull: { width: '100%' },
  meta: { color: colors.muted, fontSize: 11 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  details: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  accept: {
    flex: 1,
    height: 36,
    backgroundColor: '#10b981',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptText: { color: '#000', fontWeight: '700', fontSize: 13 },
  disabled: { opacity: 0.55 },
});
