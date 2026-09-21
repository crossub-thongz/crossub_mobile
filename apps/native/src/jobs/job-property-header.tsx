import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { NoImageDialog } from '@/src/jobs/no-image-dialog';
import {
  INSPECTION_PAY_LABEL,
  INSPECTION_TYPE_LABEL,
  isCoreInspectionType,
} from '@/src/constants/inspection';
import { formatScheduleWhen, personInitials } from '@/src/lib/datetime';
import { formatJobRefId, googleMapsUrl, propertyAddressLines } from '@/src/lib/property-address';
import type { InspectionJob } from '@/src/lib/types';
import { colors, typeAccent } from '@/src/theme';

export function JobPropertyHeader({
  job,
  inspectorName,
  showDirections = false,
  origin,
}: {
  job: InspectionJob;
  inspectorName?: string | null;
  showDirections?: boolean;
  origin?: { latitude: number; longitude: number } | null;
}) {
  return (
    <View style={styles.card}>
      <PropertyHeaderBody job={job} inspectorName={inspectorName} />
      {showDirections ? <DirectionsButton job={job} origin={origin} /> : null}
    </View>
  );
}

export function PropertyHeaderBody({
  job,
  inspectorName,
}: {
  job: InspectionJob;
  inspectorName?: string | null;
}) {
  const { street, locality } = propertyAddressLines(job);
  const visual = typeAccent[job.type];
  const typeLabel = isCoreInspectionType(job.type)
    ? INSPECTION_TYPE_LABEL[job.type]
    : (INSPECTION_PAY_LABEL[job.type] ?? job.type).toUpperCase();
  const when = formatScheduleWhen(job.scheduledTime || job.scheduledDate);

  return (
    <View style={styles.top}>
      <PropertyThumb src={job.propertyImageUrl} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.street}>{street}</Text>
            {locality ? <Text style={styles.locality}>{locality}</Text> : null}
          </View>
          <View style={[styles.typeChip, { backgroundColor: visual.tileBg, borderColor: visual.tileBorder }]}>
            <Text style={[styles.typeChipText, { color: visual.text }]}>{typeLabel}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.muted} />
            <Text style={styles.meta}>{when}</Text>
          </View>
          {inspectorName ? (
            <View style={styles.metaItem}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {personInitials({ fullName: inspectorName })}
                </Text>
              </View>
              <Text style={styles.inspector} numberOfLines={1}>
                {inspectorName}
              </Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Text style={styles.meta}>Job #{formatJobRefId(job.id)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function DirectionsButton({
  job,
  origin,
}: {
  job: InspectionJob;
  origin?: { latitude: number; longitude: number } | null;
}) {
  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(googleMapsUrl(job, origin));
      }}
      style={styles.directions}
    >
      <Ionicons name="navigate-outline" size={14} color={colors.text} />
      <Text style={styles.directionsText}>Directions</Text>
    </Pressable>
  );
}

function PropertyThumb({ src }: { src?: string | null }) {
  const [broken, setBroken] = useState(false);
  const [open, setOpen] = useState(false);
  const hasImage = Boolean(src) && !broken;

  if (hasImage) {
    return (
      <Image
        source={{ uri: src ?? undefined }}
        style={styles.thumb}
        contentFit="cover"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.thumbPlaceholder}>
        <Text style={styles.noImage}>NO IMAGE</Text>
      </Pressable>
      <NoImageDialog
        open={open}
        onClose={() => setOpen(false)}
        message="This property has no listing photo."
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  street: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 18 },
  locality: { color: colors.muted, fontSize: 12, marginTop: 2 },
  typeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeChipText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  metaRow: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  meta: { color: colors.muted, fontSize: 11 },
  inspector: { color: colors.text, fontSize: 11, fontWeight: '600', flexShrink: 1 },
  avatar: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 7, fontWeight: '700' },
  thumb: { width: 84, height: 72, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  thumbPlaceholder: {
    width: 84,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  noImage: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.4, textAlign: 'center' },
  directions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  directionsText: { color: colors.text, fontWeight: '600', fontSize: 13 },
});
