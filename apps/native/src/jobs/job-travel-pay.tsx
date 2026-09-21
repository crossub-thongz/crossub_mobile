import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD } from '@/src/constants/inspection';
import { formatCurrency } from '@/src/lib/datetime';
import { googleMapsUrl } from '@/src/lib/property-address';
import type { InspectionJob } from '@/src/lib/types';
import {
  computeTravelEstimate,
  formatDistanceKm,
  jobDestination,
  type GeoPoint,
} from '@/src/lib/travel';
import { colors } from '@/src/theme';

export function JobTravelCard({
  job,
  deviceLocation,
}: {
  job: InspectionJob;
  deviceLocation: GeoPoint | null;
}) {
  const travel = computeTravelEstimate(deviceLocation, jobDestination(job));
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Travel to site</Text>
          {travel ? (
            <Text style={styles.value}>
              {formatDistanceKm(travel.distanceKm)} · ~{travel.travelMinutes} min ETA
            </Text>
          ) : (
            <Text style={styles.muted}>
              {deviceLocation
                ? 'Site coordinates unavailable - open directions by address.'
                : 'Allow location access to see live distance and ETA.'}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => {
            void Linking.openURL(googleMapsUrl(job, deviceLocation));
          }}
          style={styles.dirBtn}
        >
          <Ionicons name="compass-outline" size={16} color={colors.primary} />
          <Text style={styles.dirText}>Google Maps</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        From your live location
        {deviceLocation
          ? ` (${deviceLocation.latitude.toFixed(4)}, ${deviceLocation.longitude.toFixed(4)})`
          : ''}{' '}
        to {job.propertyAddress}.
      </Text>
    </View>
  );
}

export function JobPayBreakdown({
  hours,
  laborAmount,
  durationLabel,
}: {
  hours: number;
  laborAmount: number;
  durationLabel?: string;
}) {
  const routineCopy =
    hours === 1 && laborAmount === ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD
      ? `$${ROUTINE_OPEN_INSPECTOR_FEE_INC_GST_AUD} inc GST per routine / open job`
      : `Agent APP price list${hours > 0 ? ` · ~${hours}h on site` : ''}`;
  return (
    <View>
      {durationLabel ? <Text style={styles.hint}>{durationLabel}</Text> : null}
      <Text style={styles.label}>Est. Fee</Text>
      <Text style={styles.fee}>{formatCurrency(laborAmount)}</Text>
      <Text style={styles.hint}>{routineCopy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  value: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 4 },
  muted: { color: colors.muted, fontSize: 13, marginTop: 4 },
  hint: { color: colors.muted, fontSize: 10, lineHeight: 16 },
  fee: { color: colors.primary, fontSize: 16, fontWeight: '700', marginTop: 2 },
  dirBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dirText: { color: colors.text, fontWeight: '600', fontSize: 12 },
});
