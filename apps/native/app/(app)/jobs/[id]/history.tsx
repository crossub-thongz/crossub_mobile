import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  fetchInspection,
  fetchInspectionDetail,
  fetchKeyCollection,
  fetchOpenViewing,
  type InspectorKeyCollection,
  type InspectorOpenViewing,
} from '@/src/api/inspector';
import { INSPECTION_PAY_LABEL } from '@/src/constants/inspection';
import { useInspections } from '@/src/inspections/inspections-context';
import { OpenViewingPanels } from '@/src/jobs/open-viewing-screen';
import {
  formatCurrency,
  formatDateTime,
  formatScheduleWhen,
} from '@/src/lib/datetime';
import { mapInspectionDetail, type FindingsRoom } from '@/src/lib/inspection-findings';
import { toInspectionJob } from '@/src/lib/job-map';
import { keyAccessFromCollection } from '@/src/lib/key-access';
import { formatJobRefId, googleMapsUrl, propertyAddressLines } from '@/src/lib/property-address';
import { shareInspectionReportPdf } from '@/src/lib/report-pdf';
import type { InspectionJob } from '@/src/lib/types';
import { colors } from '@/src/theme';

type HistoryTab = 'job' | 'report' | 'handover' | 'findings' | 'checkins' | 'qr';

const FIELD_REPORT_TYPES = new Set(['ingoing', 'outgoing', 'routine']);

function PhotoStrip({ urls, empty }: { urls: string[]; empty: string }) {
  if (urls.length === 0) {
    return <Text style={styles.muted}>{empty}</Text>;
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
      {urls.map((url) => (
        <Image key={url} source={{ uri: url }} style={styles.photo} />
      ))}
    </ScrollView>
  );
}

function FindingsRow({ room }: { room: FindingsRoom }) {
  const beforeAfter =
    (room.ingoingPhotoUrls?.length ?? 0) > 0 || (room.outgoingPhotoUrls?.length ?? 0) > 0;
  return (
    <View style={styles.findingsRow}>
      <View style={styles.findingsHead}>
        <Text style={styles.findingsTitle}>
          {beforeAfter ? `${room.area} ? Before / After` : room.area}
        </Text>
        {room.condition ? <Text style={styles.condition}>{room.condition}</Text> : null}
      </View>
      {room.comments ? <Text style={styles.muted}>{room.comments}</Text> : null}
      {beforeAfter ? (
        <View style={styles.beforeAfter}>
          <View style={styles.side}>
            <Text style={styles.sideLabel}>Ingoing</Text>
            <PhotoStrip urls={room.ingoingPhotoUrls ?? []} empty="No ingoing photo" />
          </View>
          <View style={styles.side}>
            <Text style={styles.sideLabel}>Outgoing</Text>
            <PhotoStrip urls={room.outgoingPhotoUrls ?? []} empty="No outgoing photo" />
          </View>
        </View>
      ) : (
        <PhotoStrip urls={room.photoUrls} empty="No photos for this area" />
      )}
    </View>
  );
}

function KeyPhase({
  title,
  complete,
  at,
  notes,
  photos,
  location,
}: {
  title: string;
  complete: boolean;
  at?: string | null;
  notes?: string | null;
  photos: string[];
  location?: string | null;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {!complete ? (
        <Text style={styles.muted}>Not recorded for this job.</Text>
      ) : (
        <>
          {location ? <Text style={styles.muted}>{location}</Text> : null}
          {at ? <Text style={styles.muted}>Completed {formatDateTime(at)}</Text> : null}
          {notes ? <Text style={styles.notes}>{notes}</Text> : null}
          <PhotoStrip urls={photos} empty="No key proof photos" />
        </>
      )}
    </View>
  );
}

export default function JobHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getJob, upsertJob } = useInspections();
  const cached = getJob(id);
  const [collection, setCollection] = useState<InspectorKeyCollection | null>(null);
  const [findings, setFindings] = useState<FindingsRoom[]>([]);
  const [findingsError, setFindingsError] = useState<string | null>(null);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [missing, setMissing] = useState(false);
  const [viewing, setViewing] = useState<InspectorOpenViewing | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    void (async () => {
      try {
        const dto = await fetchInspection(id);
        if (!active) return;
        const nextJob = toInspectionJob(dto);
        try {
          const nextCollection = await fetchKeyCollection(id);
          if (!active) return;
          setCollection(nextCollection);
          if (nextCollection) nextJob.keyAccess = keyAccessFromCollection(nextCollection);
        } catch {
          // History still renders without handover.
        }
        upsertJob(nextJob);
      } catch {
        if (active) setMissing(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, upsertJob]);

  const job = getJob(id) ?? cached;
  const isOpen = job?.type === 'open';
  const showReport = Boolean(job && FIELD_REPORT_TYPES.has(job.type));
  const showHandover = Boolean(job?.keyAccess || collection);
  const showFindings = Boolean(job && !isOpen);
  const showOpenExtras = Boolean(isOpen);
  const tabs = useMemo(() => {
    const items: { id: HistoryTab; label: string }[] = [{ id: 'job', label: 'Job' }];
    if (showOpenExtras) {
      items.push({ id: 'checkins', label: 'Check-ins' }, { id: 'qr', label: 'QR' });
    }
    if (showReport) items.push({ id: 'report', label: 'Report' });
    if (showHandover) items.push({ id: 'handover', label: 'Handover' });
    if (showFindings) items.push({ id: 'findings', label: 'Findings' });
    return items;
  }, [showFindings, showHandover, showOpenExtras, showReport]);
  const [tab, setTab] = useState<HistoryTab | null>(null);
  const activeTab =
    tab && tabs.some((item) => item.id === tab)
      ? tab
      : showReport
        ? 'report'
        : (tabs[0]?.id ?? 'job');

  useEffect(() => {
    if (!id || !showFindings) return;
    let active = true;
    setFindingsLoading(true);
    void fetchInspectionDetail(id)
      .then((detail) => {
        if (!active) return;
        setFindings(mapInspectionDetail(detail));
        setFindingsError(null);
      })
      .catch((err) => {
        if (!active) return;
        setFindingsError(err instanceof Error ? err.message : 'Unable to load findings.');
      })
      .finally(() => {
        if (active) setFindingsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, showFindings]);

  useEffect(() => {
    if (!id || !showOpenExtras) return;
    let active = true;
    void fetchOpenViewing(id)
      .then((next) => {
        if (active) setViewing(next);
      })
      .catch(() => {
        if (active) setViewing(null);
      });
    return () => {
      active = false;
    };
  }, [id, showOpenExtras]);

  if (!job) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Inspection report', headerBackTitle: 'Back' }} />
        <Text style={styles.pageMuted}>
          {missing ? 'Report not found' : 'Loading report?'}
        </Text>
      </SafeAreaView>
    );
  }

  const { street, locality } = propertyAddressLines(job);
  const submittedAt =
    typeof job.workflowData?.inspectionFinishedAt === 'string'
      ? job.workflowData.inspectionFinishedAt
      : job.approvedAt;
  const location = collection?.keyCollection?.location ?? null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Inspection report', headerBackTitle: 'Back' }} />
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setTab(item.id)}
            style={[styles.tab, activeTab === item.id && styles.tabOn]}
          >
            <Text style={[styles.tabLabel, activeTab === item.id && styles.tabLabelOn]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.chipRow}>
          <Text style={styles.typeChip}>{job.type.toUpperCase()}</Text>
          <Text style={styles.statusChip}>{job.status.replace('_', ' ')}</Text>
        </View>
        <View style={styles.addressRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.street}>{street}</Text>
            {locality ? <Text style={styles.muted}>{locality}</Text> : null}
          </View>
          <View style={styles.feeCol}>
            <Text style={styles.fee}>{formatCurrency(job.laborAmount)}</Text>
            <Text style={styles.feeLabel}>Fee</Text>
          </View>
        </View>

        {activeTab === 'job' ? (
          <JobSummary job={job} submittedAt={submittedAt} />
        ) : null}

        {activeTab === 'checkins' ? (
          viewing ? (
            <OpenViewingPanels viewing={viewing} panel="checkins" />
          ) : (
            <Text style={styles.muted}>No check-in records for this open.</Text>
          )
        ) : null}

        {activeTab === 'qr' ? (
          viewing ? (
            <OpenViewingPanels viewing={viewing} panel="qr" />
          ) : (
            <Text style={styles.muted}>QR codes are not available for this open.</Text>
          )
        ) : null}

        {activeTab === 'report' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Inspection report</Text>
            <Text style={styles.muted}>
              Download the filed inspection PDF and share it to Files, Mail, or another app.
            </Text>
            <Pressable
              disabled={pdfBusy}
              onPress={() => {
                setPdfBusy(true);
                void shareInspectionReportPdf({
                  inspectionId: job.id,
                  type: job.type,
                  propertyAddress: job.propertyAddress,
                })
                  .catch((err) =>
                    Alert.alert(
                      'Report not available',
                      err instanceof Error ? err.message : 'Inspection report is not available yet.',
                    ),
                  )
                  .finally(() => setPdfBusy(false));
              }}
              style={[styles.primary, pdfBusy && { opacity: 0.55 }]}
            >
              {pdfBusy ? (
                <ActivityIndicator color={colors.primaryFg} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={16} color={colors.primaryFg} />
                  <Text style={styles.primaryText}>Share PDF</Text>
                </>
              )}
            </Pressable>
            {job.reportUrl ? (
              <Pressable
                onPress={() => {
                  void Linking.openURL(job.reportUrl as string);
                }}
                style={styles.secondary}
              >
                <Ionicons name="open-outline" size={16} color={colors.primary} />
                <Text style={styles.secondaryText}>Open hosted report</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'handover' ? (
          <>
            <KeyPhase
              title="Handover (collecting keys)"
              complete={Boolean(collection?.custody.collectComplete || job.keyAccess?.collectComplete)}
              at={collection?.custody.collectedAt}
              notes={collection?.custody.collectNotes}
              photos={collection?.custody.collectPhotos ?? []}
              location={location}
            />
            <KeyPhase
              title="Handover (returning keys)"
              complete={Boolean(collection?.custody.returnComplete || job.keyAccess?.returnComplete)}
              at={collection?.custody.returnedAt}
              notes={collection?.custody.returnNotes}
              photos={collection?.custody.returnPhotos ?? []}
              location={location}
            />
          </>
        ) : null}

        {activeTab === 'findings' ? (
          findingsLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : findingsError ? (
            <Text style={styles.danger}>{findingsError}</Text>
          ) : findings.length === 0 ? (
            <Text style={styles.empty}>No inspection findings saved for this job.</Text>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Inspection findings</Text>
              {findings.map((room) => (
                <FindingsRow key={room.area} room={room} />
              ))}
            </View>
          )
        ) : null}

        <Pressable onPress={() => router.back()} style={styles.secondary}>
          <Text style={styles.secondaryText}>Back to job history</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function JobSummary({
  job,
  submittedAt,
}: {
  job: InspectionJob;
  submittedAt?: string;
}) {
  const { street, locality } = propertyAddressLines(job);
  return (
    <>
      {submittedAt ? (
        <Text style={styles.muted}>Report submitted {formatDateTime(submittedAt)}</Text>
      ) : null}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Job Details</Text>
          <Text style={styles.typeChip}>{INSPECTION_PAY_LABEL[job.type] ?? job.type}</Text>
        </View>
        <View style={styles.thumbRow}>
          {job.propertyImageUrl ? (
            <Image source={{ uri: job.propertyImageUrl }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.muted}>NO IMAGE</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.street}>{street}</Text>
            {locality ? <Text style={styles.muted}>{locality}</Text> : null}
          </View>
        </View>
        <Text style={styles.muted}>{formatScheduleWhen(job.scheduledTime || job.scheduledDate)}</Text>
        <Text style={styles.muted}>Job #{formatJobRefId(job.id)}</Text>
        <Pressable
          onPress={() => {
            void Linking.openURL(googleMapsUrl(job));
          }}
          style={styles.secondary}
        >
          <Ionicons name="compass-outline" size={16} color={colors.primary} />
          <Text style={styles.secondaryText}>Directions</Text>
        </Pressable>
        <Text style={styles.fee}>Fee {formatCurrency(job.laborAmount)}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Agency</Text>
        <Text style={styles.street}>{job.agentName || job.agentCompany || '?'}</Text>
        {job.agentCompany && job.agentName ? (
          <Text style={styles.muted}>{job.agentCompany}</Text>
        ) : null}
        {job.agentPhone ? <Text style={styles.muted}>{job.agentPhone}</Text> : null}
        {job.agentEmail ? <Text style={styles.muted}>{job.agentEmail}</Text> : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 12 },
  pageMuted: { color: colors.muted, padding: 16 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabOn: { borderBottomColor: colors.primary },
  tabLabel: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  tabLabelOn: { color: colors.primary },
  chipRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    color: colors.primary,
    backgroundColor: 'rgba(0,212,164,0.15)',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '700',
  },
  statusChip: {
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
    overflow: 'hidden',
  },
  addressRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  feeCol: { alignItems: 'flex-end' },
  street: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 12 },
  fee: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  feeLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  thumbRow: { flexDirection: 'row', gap: 12 },
  thumb: { width: 64, height: 64, borderRadius: 8 },
  thumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { color: colors.primaryFg, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  danger: { color: colors.destructive, fontSize: 13 },
  empty: {
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    textAlign: 'center',
  },
  findingsRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 8,
    gap: 6,
  },
  findingsHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  findingsTitle: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  condition: {
    color: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
    textTransform: 'uppercase',
    overflow: 'hidden',
  },
  beforeAfter: { flexDirection: 'row', gap: 12 },
  side: { flex: 1, gap: 6 },
  sideLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  photos: { gap: 8 },
  photo: { width: 96, height: 96, borderRadius: 8, backgroundColor: colors.secondary },
  notes: {
    color: colors.text,
    fontSize: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
  },
});
