import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
  acceptInspection,
  declineInspection,
  fetchInspection,
  fetchKeyCollection,
} from '@/src/api/inspector';
import { useInspections } from '@/src/inspections/inspections-context';
import { CancelTaskSheet } from '@/src/jobs/cancel-task-sheet';
import { FieldWorkflowScreen } from '@/src/jobs/field-workflow';
import { JobHandoverPanel } from '@/src/jobs/job-handover';
import { JobLookupFallback } from '@/src/jobs/job-lookup-fallback';
import { JobSummaryCard } from '@/src/jobs/job-summary-card';
import { JobPayBreakdown, JobTravelCard } from '@/src/jobs/job-travel-pay';
import { OpenViewingScreen } from '@/src/jobs/open-viewing-screen';
import { PendingSyncBanner } from '@/src/offline/pending-sync-banner';
import {
  JobWorkspaceNav,
  parseKeysPhase,
  parseWorkspaceTab,
  type WorkspaceTab,
} from '@/src/jobs/workspace-nav';
import { formatDate, formatScheduleWhen } from '@/src/lib/datetime';
import { jobLookupMiss } from '@/src/lib/job-lookup';
import {
  jobInspectionStarted,
  jobPrimaryAction,
} from '@/src/lib/inspection-job-cta';
import { tenantEmailHref, tenantPhoneHref } from '@/src/lib/inspection-start-flow';
import { isPoolJob } from '@/src/lib/inspector-job-filters';
import { toInspectionJob } from '@/src/lib/job-map';
import {
  isInspectionWorkflowFinished,
  isKeyCollectComplete,
  isKeyReturnComplete,
  jobAccessMethodLabel,
  jobKeysCountLabel,
  applyKeyCollection,
} from '@/src/lib/key-access';
import { formatJobRefId, propertyAddressLines } from '@/src/lib/property-address';
import { jobHistory } from '@/src/lib/routes';
import { colors } from '@/src/theme';

function Banner({ tone, children }: { tone: 'amber' | 'danger' | 'ok'; children: string }) {
  return (
    <Text
      style={tone === 'danger' ? styles.danger : tone === 'ok' ? styles.ok : styles.amber}
    >
      {children}
    </Text>
  );
}

export default function JobDetailsScreen() {
  const { id, tab: tabParam, keys: keysParam } = useLocalSearchParams<{
    id: string;
    tab?: string;
    keys?: string;
  }>();
  const router = useRouter();
  const { getJob, getDraft, upsertJob, claim, claimingId, refresh, deviceLocation, jobsHydrated } =
    useInspections();
  const cached = getJob(id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [idLookupDone, setIdLookupDone] = useState(!id);
  const [tab, setTab] = useState<WorkspaceTab>(() => parseWorkspaceTab(tabParam));
  const [keysPhase, setKeysPhase] = useState<'collect' | 'return'>(() => parseKeysPhase(keysParam));

  useEffect(() => {
    if (!id) {
      setIdLookupDone(true);
      return;
    }
    let cancelled = false;
    setIdLookupDone(false);
    void (async () => {
      try {
        const dto = await fetchInspection(id);
        let next = toInspectionJob(dto);
        try {
          const collection = await fetchKeyCollection(id);
          if (collection) next = applyKeyCollection(next, collection);
        } catch {
          // ignore
        }
        if (!cancelled) upsertJob(next);
      } catch {
        // Keep the cached card if the job is a pool preview.
      } finally {
        if (!cancelled) setIdLookupDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, upsertJob]);

  useEffect(() => {
    setTab(parseWorkspaceTab(tabParam));
  }, [tabParam]);

  useEffect(() => {
    setKeysPhase(parseKeysPhase(keysParam));
  }, [keysParam]);

  const selectTab = useCallback(
    (next: WorkspaceTab, extras?: { keys?: 'collect' | 'return' }) => {
      const nextKeys = extras?.keys ?? (next === 'handover' ? keysPhase : undefined);
      if (extras?.keys) setKeysPhase(extras.keys);
      setTab(next);
      router.setParams({
        tab: next,
        keys: nextKeys ?? '',
      });
    },
    [keysPhase, router],
  );

  const job = getJob(id) ?? cached;
  if (!job) {
    const lookup = jobLookupMiss(jobsHydrated, idLookupDone);
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={{ title: lookup === 'loading' ? 'Loading job' : 'Job not found' }} />
        <JobLookupFallback state={lookup} />
      </SafeAreaView>
    );
  }

  const poolPreview = isPoolJob(job);
  const draft = getDraft(job.id);
  const started = jobInspectionStarted(job, draft);
  const primary = jobPrimaryAction(job, started);
  const keyCollectDone = isKeyCollectComplete(job);
  const keyReturnDone = isKeyReturnComplete(job);
  const inspectionFinished = isInspectionWorkflowFinished(job, draft);
  const paymentBlocked = Boolean(job.awaitingAgentPayment);
  const keysBlocked = Boolean(job.keyAccess && !keyCollectDone);
  const returnPending =
    Boolean(job.keyAccess && inspectionFinished && !keyReturnDone && job.status !== 'completed');
  const { street, locality } = propertyAddressLines(job);
  const title = poolPreview ? 'Job preview' : street || job.propertyAddress;

  const handoverNext = Boolean(job.keyAccess && !keyCollectDone && !paymentBlocked);
  const ctaLabel = paymentBlocked
    ? 'Waiting for agency payment'
    : returnPending
      ? 'Return keys'
      : job.status === 'awaiting_approval'
        ? 'Pending Approval'
        : job.status === 'completed'
          ? 'View inspection report'
          : handoverNext
            ? 'Continue to Handover'
            : primary.label;
  const ctaDisabled =
    paymentBlocked ||
    (job.status === 'awaiting_approval' && !returnPending) ||
    (handoverNext ? false : keysBlocked);

  const onAccept = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isPoolJob(job)) {
        const next = await claim(job.id);
        if (next.awaitingAgentPayment) return;
        const tabPart = jobPrimaryAction(next, false).href.split('tab=')[1]?.split('&')[0];
        selectTab(parseWorkspaceTab(tabPart));
        return;
      }
      const dto = await acceptInspection(job.id);
      const next = toInspectionJob(dto);
      upsertJob({ ...job, ...next, keyAccess: job.keyAccess });
      if (next.awaitingAgentPayment) return;
      const tabPart = jobPrimaryAction({ ...job, ...next }, false).href.split('tab=')[1]?.split('&')[0];
      selectTab(parseWorkspaceTab(tabPart));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not accept this job.');
    } finally {
      setBusy(false);
    }
  };

  const onDecline = async () => {
    setBusy(true);
    try {
      await declineInspection(job.id);
      router.replace('/pool');
    } catch (err) {
      Alert.alert('Could not decline', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (poolPreview) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={{ title }} />
        <ScrollView contentContainerStyle={styles.inner}>
          <Text style={styles.hint}>
            Review scheduled date, address, payout, and job type. Accept to open the{' '}
            {job.type} inspection workflow.
          </Text>
          {paymentBlocked ? (
            <Banner tone="amber">
              Waiting for the agency to pay the platform fee. You can accept this job, but you cannot start until payment clears.
            </Banner>
          ) : null}
          {error ? <Text style={styles.danger}>{error}</Text> : null}
          <PendingSyncBanner />
          <JobSummaryCard job={job} />
          <Pressable
            onPress={() => {
              void onAccept();
            }}
            disabled={busy || claimingId === job.id}
            style={[styles.primary, (busy || claimingId === job.id) && styles.disabled]}
          >
            {busy ? <ActivityIndicator color={colors.primaryFg} /> : <Text style={styles.primaryText}>Accept job</Text>}
          </Pressable>
          <Pressable onPress={() => void onDecline()} style={styles.secondary}>
            <Text style={styles.secondaryText}>Decline</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title }} />
      <JobWorkspaceNav job={job} active={tab} onSelect={selectTab} />
      <PendingSyncBanner inset />
      {tab === 'handover' && id ? (
        <JobHandoverPanel
          id={id}
          phase={keysPhase}
          onChangeTab={selectTab}
          onFinished={() => router.replace('/')}
        />
      ) : null}
      {tab === 'areas' && job.type !== 'open' ? (
        <FieldWorkflowScreen type={job.type} view="areas" onChangeTab={selectTab} />
      ) : null}
      {tab === 'start' && job.type === 'open' ? (
        <OpenViewingScreen onChangeTab={selectTab} />
      ) : null}
      {tab === 'start' && job.type !== 'open' ? (
        <FieldWorkflowScreen type={job.type} view="inspect" onChangeTab={selectTab} />
      ) : null}
      {tab === 'details' ? (
      <>
      <ScrollView contentContainerStyle={styles.inner}>
        {paymentBlocked ? (
          <Banner tone="amber">
            Waiting for the agency to pay the platform fee. You cannot start this job until payment clears.
          </Banner>
        ) : keysBlocked ? (
          <Banner tone="amber">Complete handover before starting the inspection.</Banner>
        ) : null}
        {job.approvedAt && job.status === 'completed' ? (
          <Banner tone="ok">Report approved. You can view the inspection report.</Banner>
        ) : null}
        {job.reportDeclineReason &&
        job.status !== 'completed' &&
        job.status !== 'awaiting_approval' ? (
          <Banner tone="danger">
            {`Report declined — ${job.reportDeclineReason} Redo the inspection and resubmit your report.`}
          </Banner>
        ) : null}
        {returnPending ? (
          <Banner tone="amber">Inspection finished — return the keys to complete this task.</Banner>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>Job Details</Text>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>{job.type.toUpperCase()}</Text>
            </View>
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
          <Text style={styles.meta}>{formatScheduleWhen(job.scheduledTime)}</Text>
          <Text style={styles.meta}>Job #{formatJobRefId(job.id)}</Text>
          <JobPayBreakdown
            hours={job.estimatedHours}
            laborAmount={job.laborAmount}
            durationLabel={job.durationLabel}
          />
        </View>

        <JobTravelCard job={job} deviceLocation={deviceLocation} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Key Details</Text>
          <Detail label="Tenant" value={job.tenantName?.trim() || '-'} />
          <Detail
            label="Phone"
            value={job.tenantPhone?.trim() || '-'}
            href={tenantPhoneHref(job.tenantPhone)}
          />
          <Detail
            label="Email"
            value={job.tenantEmail?.trim() || '-'}
            href={tenantEmailHref(job.tenantEmail)}
          />
          <Detail label="Lease Start" value={job.leaseStart ? formatDate(job.leaseStart) : '-'} />
          <Detail label="Lease End" value={job.leaseEnd ? formatDate(job.leaseEnd) : '-'} />
          <Detail label="Property Manager" value={job.agentName || job.agentCompany || '-'} />
          <Detail label="Access Method" value={jobAccessMethodLabel(job)} />
          {job.keyAccess?.code ? <Detail label="Access code" value={job.keyAccess.code} /> : null}
          {job.keyAccess?.location ? (
            <Detail label="Pickup location" value={job.keyAccess.location} />
          ) : null}
          <Detail label="Keys" value={jobKeysCountLabel(job)} />
          <Detail label="Special Instructions" value={job.notes?.trim() || '-'} />
        </View>

        <Pressable
          disabled={ctaDisabled}
          onPress={() => {
            if (job.status === 'completed') {
              router.push(jobHistory(job.id) as never);
              return;
            }
            if (returnPending) selectTab('handover', { keys: 'return' });
            else if (handoverNext) selectTab('handover', { keys: 'collect' });
            else if (job.type === 'open' || started) selectTab('start');
            else selectTab('areas');
          }}
          style={[styles.primary, ctaDisabled && styles.disabled]}
        >
          <Text style={styles.primaryText}>{ctaLabel}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primaryFg} />
        </Pressable>
        {job.status === 'in_progress' ? (
          <Pressable onPress={() => setCancelOpen(true)} style={styles.secondary}>
            <Text style={styles.dangerText}>Cancel task</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <CancelTaskSheet
        visible={cancelOpen}
        inspectionId={job.id}
        urgent={job.priority === 'urgent'}
        onClose={() => setCancelOpen(false)}
        onReleased={() => {
          setCancelOpen(false);
          void refresh();
          router.replace('/');
        }}
      />
      </>
      ) : null}
    </SafeAreaView>
  );
}

function Detail({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string | null;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.muted}>{label}</Text>
      {href ? (
        <Pressable onPress={() => void Linking.openURL(href)} hitSlop={8}>
          <Text style={styles.detailLink}>{value}</Text>
        </Pressable>
      ) : (
        <Text style={styles.detailValue} numberOfLines={1}>
          {value}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 12 },
  hint: { color: colors.muted, fontSize: 12 },
  amber: {
    color: colors.amber,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    overflow: 'hidden',
  },
  danger: {
    color: colors.destructive,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    overflow: 'hidden',
  },
  ok: {
    color: colors.primary,
    backgroundColor: 'rgba(0,212,164,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,164,0.3)',
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    overflow: 'hidden',
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
  typeChip: {
    backgroundColor: 'rgba(0,212,164,0.15)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeChipText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
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
  street: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 12 },
  meta: { color: colors.muted, fontSize: 12 },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
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
  dangerText: { color: colors.destructive, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  detailValue: { color: colors.text, fontSize: 12, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  detailLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
});
