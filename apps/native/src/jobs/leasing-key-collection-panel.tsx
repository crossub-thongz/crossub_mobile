import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDateTime } from '@/src/lib/datetime';
import { hasKeyCollectionPhotos, hasTenantKeyReport } from '@/src/lib/key-access';
import type {
  InspectorLeasingKeyContext,
  LeasingKeyCollectionTenantReport,
} from '@/src/lib/types';
import { colors } from '@/src/theme';

const REPORT_ROWS: {
  key: keyof Omit<LeasingKeyCollectionTenantReport, 'submittedAt' | 'tagNumber'>;
  label: string;
}[] = [
  { key: 'keysCount', label: 'Keys' },
  { key: 'entryDoorCount', label: 'Entry door' },
  { key: 'windowSlidingCount', label: 'Window / sliding' },
  { key: 'fobsCount', label: 'Fobs' },
  { key: 'remoteControlCount', label: 'Remote controls' },
  { key: 'mailboxCount', label: 'Mailbox' },
  { key: 'othersCount', label: 'Other' },
];

function AvailabilityMark({ available }: { available: boolean }) {
  return (
    <View
      style={[styles.mark, available ? styles.markOn : styles.markOff]}
      accessibilityLabel={available ? 'Available' : 'Missing'}
    >
      <Ionicons
        name={available ? 'checkmark' : 'close'}
        size={12}
        color={available ? '#34d399' : '#f87171'}
      />
    </View>
  );
}

function reportValue(
  report: LeasingKeyCollectionTenantReport,
  key: (typeof REPORT_ROWS)[number]['key'],
): string {
  const value = report[key];
  return value == null ? '-' : String(value);
}

export function LeasingKeyCollectionPanel({
  context,
}: {
  context: InspectorLeasingKeyContext;
}) {
  const { keyCollection, propertyAddress } = context;
  const photos = keyCollection.photos ?? [];
  const report = keyCollection.tenantReport;
  const photoReady = hasKeyCollectionPhotos(keyCollection);
  const checklistReady = hasTenantKeyReport(keyCollection);
  const reportReady = checklistReady || (photoReady && keyCollection.status === 'done');
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [reportExpanded, setReportExpanded] = useState(false);
  const hasTenantEvidence = photoReady || checklistReady || reportReady;

  return (
    <View style={styles.wrap}>
      {!hasTenantEvidence ? (
        <Text style={styles.empty}>No tenant key handover evidence on this case yet.</Text>
      ) : null}

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <View style={styles.blockCopy}>
            <AvailabilityMark available={photoReady} />
            <View style={styles.blockText}>
              <Text style={styles.blockTitle}>Tenant photo proof</Text>
              <Text style={styles.blockHint}>
                {photoReady
                  ? photos.length === 1
                    ? '1 photo from tenant (this leasing case)'
                    : `${photos.length} photos from tenant (this leasing case)`
                  : 'No tenant photo on this case'}
              </Text>
            </View>
          </View>
          {photoReady ? (
            <Pressable
              onPress={() => setPhotosExpanded((value) => !value)}
              style={styles.viewBtn}
              accessibilityLabel={photosExpanded ? 'Hide tenant photos' : 'View tenant photos'}
            >
              <Ionicons name="camera-outline" size={12} color={colors.text} />
              <Text style={styles.viewBtnText}>{photosExpanded ? 'Hide' : 'View'}</Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={colors.muted}
                style={photosExpanded ? styles.chevronOn : undefined}
              />
            </Pressable>
          ) : null}
        </View>
        {photosExpanded && photoReady ? (
          <View style={styles.photoGrid}>
            {photos.map((url, index) => (
              <Image
                key={`${url}-${index}`}
                source={{ uri: url }}
                style={styles.photo}
                contentFit="cover"
                cachePolicy="disk"
                recyclingKey={url}
                accessibilityLabel={`Key collection photo ${index + 1}`}
              />
            ))}
            {propertyAddress ? <Text style={styles.address}>{propertyAddress}</Text> : null}
          </View>
        ) : null}
      </View>

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <View style={styles.blockCopy}>
            <AvailabilityMark available={reportReady} />
            <View style={styles.blockText}>
              <Text style={styles.blockTitle}>Tenant key collection report</Text>
              <Text style={styles.blockHint}>
                {reportReady
                  ? checklistReady && report?.submittedAt
                    ? `Checklist ${formatDateTime(report.submittedAt)}`
                    : 'Tenant report on this leasing case'
                  : 'No tenant report on this case'}
              </Text>
            </View>
          </View>
          {reportReady ? (
            <Pressable
              onPress={() => setReportExpanded((value) => !value)}
              style={styles.viewBtn}
              accessibilityLabel={
                reportExpanded ? 'Hide tenant key report' : 'View tenant key report'
              }
            >
              <Ionicons name="clipboard-outline" size={12} color={colors.text} />
              <Text style={styles.viewBtnText}>{reportExpanded ? 'Hide' : 'View'}</Text>
              <Ionicons
                name="chevron-down"
                size={12}
                color={colors.muted}
                style={reportExpanded ? styles.chevronOn : undefined}
              />
            </Pressable>
          ) : null}
        </View>
        {reportExpanded && reportReady ? (
          checklistReady && report ? (
            <View style={styles.reportBody}>
              {report.submittedAt ? (
                <Text style={styles.blockHint}>Submitted {formatDateTime(report.submittedAt)}</Text>
              ) : null}
              {report.tagNumber ? (
                <View style={styles.tagBox}>
                  <Text style={styles.tagLabel}>Tag number</Text>
                  <Text style={styles.tagValue}>{report.tagNumber}</Text>
                </View>
              ) : null}
              <View style={styles.table}>
                <View style={styles.tableHead}>
                  <Text style={styles.tableHeadText}>Item</Text>
                  <Text style={styles.tableHeadText}>Qty</Text>
                </View>
                {REPORT_ROWS.map(({ key, label }) => (
                  <View key={key} style={styles.tableRow}>
                    <Text style={styles.tableLabel}>{label}</Text>
                    <Text style={styles.tableQty}>{reportValue(report, key)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <Text style={styles.blockHint}>
              Photo proof submitted; detailed handover checklist not recorded yet.
            </Text>
          )
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(28,35,38,0.35)',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  empty: { color: colors.muted, fontSize: 11 },
  block: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  blockHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  blockCopy: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  blockText: { flex: 1, gap: 2 },
  blockTitle: { color: colors.text, fontSize: 12, fontWeight: '600' },
  blockHint: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  mark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  markOn: { borderColor: 'rgba(52,211,153,0.6)', backgroundColor: 'rgba(16,185,129,0.15)' },
  markOff: { borderColor: 'rgba(248,113,113,0.4)', backgroundColor: 'rgba(244,63,94,0.1)' },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  viewBtnText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  chevronOn: { transform: [{ rotate: '180deg' }] },
  photoGrid: { gap: 8 },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 8,
    backgroundColor: colors.secondary,
  },
  address: { color: colors.muted, fontSize: 10 },
  reportBody: { gap: 10 },
  tagBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tagLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tagValue: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  table: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tableHeadText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tableLabel: { color: colors.text, fontSize: 13 },
  tableQty: { color: colors.text, fontSize: 13, fontVariant: ['tabular-nums'] },
});
