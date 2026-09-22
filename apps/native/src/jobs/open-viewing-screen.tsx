import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  acceptInspection,
  completeInspection,
  fetchOpenViewing,
  startOpenViewing,
  type InspectorOpenViewing,
  type InspectorOpenViewingVisitor,
} from '@/src/api/inspector';
import { useInspections } from '@/src/inspections/inspections-context';
import { CancelTaskSheet } from '@/src/jobs/cancel-task-sheet';
import { JobLookupFallback } from '@/src/jobs/job-lookup-fallback';
import { useFinishInspection } from '@/src/jobs/use-finish-inspection';
import { type WorkspaceTab } from '@/src/jobs/workspace-nav';
import { formatDateTime, formatInspectTime } from '@/src/lib/datetime';
import { isKeyCollectComplete, isKeyReturnComplete } from '@/src/lib/key-access';
import { jobLookupMiss } from '@/src/lib/job-lookup';
import {
  formatOpenInspectionClock,
  openInspectionQrImageUrl,
  openInspectionRemainingRatio,
  splitOpenInspectionVisitors,
} from '@/src/lib/open-viewing';
import { colors } from '@/src/theme';

function sourceLabel(source: string): string {
  const value = source.trim().toLowerCase();
  if (value === 'walk_in') return 'Walk-in';
  if (value === 'qr' || value === 'check_in' || value === 'checkin') return 'Check-in QR';
  if (value === 'application' || value === 'apply') return 'Application form';
  if (!value) return 'Application form';
  return source.replace(/_/g, ' ');
}

function OpenInspectionHelpCard() {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.card}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.helpHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Need help?</Text>
          <Text style={styles.muted}>Learn how open inspections work and best practices</Text>
        </View>
        <Text style={styles.link}>{open ? 'Hide' : 'View guide'}</Text>
      </Pressable>
      {open ? (
        <View style={styles.helpBody}>
          <Text style={styles.body}>
            Check-in QR - prospects scan this at the door so they appear under Check-ins.
          </Text>
          <Text style={styles.body}>
            Application QR - prospects who already want the property scan this to apply. They show
            as Interested (already applied via the application form).
          </Text>
          <Text style={styles.body}>
            Finish early anytime, or the job completes automatically when the viewing window ends.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function VisitorDetailSheet({
  visitor,
  kind,
  onClose,
}: {
  visitor: InspectorOpenViewingVisitor;
  kind: 'checkin' | 'interested';
  onClose: () => void;
}) {
  const phone = visitor.phone?.trim() ?? '';
  const email = visitor.email?.trim() ?? '';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <View style={styles.sheetHead}>
            <Text style={styles.cardTitle}>{visitor.name || 'Prospect'}</Text>
            <Pressable onPress={onClose}>
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </View>
          <Text style={styles.muted}>
            {kind === 'checkin' ? 'Check-in details' : 'Applicant details'} ?{' '}
            {sourceLabel(visitor.registrationSource)}
          </Text>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>Phone</Text>
            {phone ? (
              <Pressable onPress={() => void Linking.openURL(`tel:${phone}`)}>
                <Text style={styles.link}>{phone}</Text>
              </Pressable>
            ) : (
              <Text style={styles.visitorName}>-</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>Email</Text>
            {email ? (
              <Pressable onPress={() => void Linking.openURL(`mailto:${email}`)}>
                <Text style={styles.link}>{email}</Text>
              </Pressable>
            ) : (
              <Text style={styles.visitorName}>-</Text>
            )}
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.muted}>{kind === 'checkin' ? 'Checked in' : 'Applied'}</Text>
            <Text style={styles.visitorName}>
              {visitor.createdAt ? formatDateTime(visitor.createdAt) : '-'}
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function VisitorList({
  title,
  empty,
  visitors,
  kind,
}: {
  title: string;
  empty: string;
  visitors: InspectorOpenViewingVisitor[];
  kind: 'checkin' | 'interested';
}) {
  const [sort, setSort] = useState<'time' | 'name'>('time');
  const [selected, setSelected] = useState<InspectorOpenViewingVisitor | null>(null);
  const sorted = useMemo(() => {
    const next = [...visitors];
    next.sort((a, b) => {
      if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });
    return next;
  }, [visitors, sort]);

  return (
    <View style={styles.card}>
      <View style={styles.helpHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {kind === 'checkin' ? (
          <Pressable onPress={() => setSort((value) => (value === 'time' ? 'name' : 'time'))}>
            <Text style={styles.link}>Sort by {sort === 'time' ? 'name' : 'time'}</Text>
          </Pressable>
        ) : null}
      </View>
      {sorted.length === 0 ? (
        <Text style={styles.muted}>{empty}</Text>
      ) : (
        sorted.map((visitor) => (
          <Pressable
            key={visitor.id}
            onPress={() => setSelected(visitor)}
            style={styles.visitor}
          >
            <Text style={styles.visitorName}>{visitor.name || 'Prospect'}</Text>
            <Text style={styles.muted}>
              {[visitor.phone, visitor.email].filter(Boolean).join(' ? ') || 'No contact'}
              {visitor.createdAt ? ` ? ${formatInspectTime(visitor.createdAt)}` : ''}
            </Text>
            <Text style={styles.link}>View</Text>
          </Pressable>
        ))
      )}
      {selected ? (
        <VisitorDetailSheet
          visitor={selected}
          kind={kind}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </View>
  );
}

function QrBlock({ label, hint, url }: { label: string; hint: string; url: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>
      <Text style={styles.muted}>{hint}</Text>
      {url ? (
        <Image source={{ uri: openInspectionQrImageUrl(url, 256) }} style={styles.qr} />
      ) : null}
      <Pressable
        onPress={() => {
          void Share.share({ message: url, url });
        }}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Share link</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void Linking.openURL(url);
        }}
        style={styles.secondary}
      >
        <Text style={styles.secondaryText}>Open link</Text>
      </Pressable>
    </View>
  );
}

export function OpenViewingPanels({
  viewing,
  panel,
}: {
  viewing: InspectorOpenViewing;
  panel: 'checkins' | 'qr';
}) {
  const split = splitOpenInspectionVisitors(viewing.visitors ?? []);
  if (panel === 'qr') {
    return (
      <>
        <Text style={styles.body}>Share with prospects. Prospects can scan or use the link below.</Text>
        <QrBlock
          label="Check-in QR"
          hint="Prospects scan to register their arrival at the open."
          url={viewing.checkInUrl}
        />
        <QrBlock
          label="Application QR"
          hint="Prospects scan to apply for this property."
          url={viewing.applyUrl}
        />
      </>
    );
  }
  return (
    <>
      <VisitorList
        title={`Check-ins (${split.checkIns.length})`}
        empty="No check-ins yet. Prospects who scan the check-in QR will appear here."
        visitors={split.checkIns}
        kind="checkin"
      />
      <VisitorList
        title={`${split.interested.length} interested`}
        empty="Already applied via application form"
        visitors={split.interested}
        kind="interested"
      />
    </>
  );
}

export function OpenViewingScreen({
  onChangeTab,
}: {
  onChangeTab?: (tab: WorkspaceTab, extras?: { keys?: 'collect' | 'return' }) => void;
}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getJob, upsertJob, patchJob, refresh, jobsHydrated } = useInspections();
  const job = getJob(id);
  const [viewing, setViewing] = useState<InspectorOpenViewing | null>(null);
  const [tab, setTab] = useState<'checkins' | 'qr'>('checkins');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [cancelOpen, setCancelOpen] = useState(false);
  const { celebrate, celebrating, Celebration } = useFinishInspection({
    onHome: () => router.replace('/'),
    onKeys: () => {
      if (onChangeTab) onChangeTab('handover', { keys: 'return' });
      else if (id) router.replace(`/jobs/${id}?tab=handover&keys=return` as never);
    },
  });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const pull = async () => {
      try {
        const next = await fetchOpenViewing(id);
        if (active) setViewing(next);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load open viewing');
      }
    };
    void pull();
    const timer = setInterval(() => {
      void pull();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);

  if (!job || !id) {
    return (
      <View style={styles.safe}>
        <JobLookupFallback state={jobLookupMiss(jobsHydrated)} />
      </View>
    );
  }

  const paymentBlocked = Boolean(job.awaitingAgentPayment || viewing?.awaitingAgentPayment);
  const keysBlocked = Boolean(job.keyAccess && !isKeyCollectComplete(job));
  const live = viewing?.sessionStatus === 'open' || Boolean(viewing?.openedAt);
  const ended = viewing?.sessionStatus === 'closed' || Boolean(viewing?.closedAt);
  const canStart = Boolean(viewing?.canStart) && !paymentBlocked && !keysBlocked && !live;
  const startEarly = Boolean(
    viewing && new Date(viewing.startTime).getTime() > Date.now() && canStart,
  );
  const clock = viewing ? formatOpenInspectionClock(viewing.endTime, now) : '-';
  const remainingRatio = viewing
    ? openInspectionRemainingRatio(
        viewing.originalScheduledStart ?? viewing.startTime,
        viewing.endTime,
        now,
      )
    : 0;
  const returnPending =
    Boolean(job.keyAccess && ended && !isKeyReturnComplete(job) && job.status !== 'completed');

  const start = async () => {
    setBusy('start');
    setError(null);
    try {
      if (job.status === 'assigned') {
        const dto = await acceptInspection(id);
        upsertJob({ ...job, status: 'in_progress', id: dto.id });
      }
      const next = await startOpenViewing(id);
      setViewing(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start open inspection');
    } finally {
      setBusy(null);
    }
  };

  const finish = async (early: boolean) => {
    if (!viewing || celebrating) return;
    setBusy('complete');
    setError(null);
    try {
      const startTime = viewing.openedAt ?? viewing.startTime;
      const endTime = early ? new Date().toISOString() : viewing.endTime;
      if (job.keyAccess && !isKeyReturnComplete(job)) {
        await completeInspection(id, { startTime, endTime }).catch(() => undefined);
        patchJob(id, { workflowData: { ...job.workflowData, inspectionFinished: true } });
        celebrate(
          'Return the keys to complete this task.',
          'keys',
          'Viewing ended',
        );
        return;
      }
      const completed = await completeInspection(id, { startTime, endTime });
      upsertJob({ ...job, status: completed.status === 'COMPLETED' ? 'completed' : job.status });
      await refresh();
      celebrate(
        early
          ? 'Open inspection finished early.'
          : 'Viewing window ended - job completed automatically.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete this open inspection.');
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!viewing || !live || ended || busy) return;
    if (new Date(viewing.endTime).getTime() > Date.now()) return;
    void finish(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, viewing?.endTime, live, ended]);

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.inner}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {paymentBlocked ? (
          <Text style={styles.banner}>
            Waiting for the agency to pay the platform fee before you can start this open inspection.
          </Text>
        ) : null}
        {keysBlocked ? (
          <Text style={styles.banner}>Complete handover before starting the inspection.</Text>
        ) : null}

        {viewing ? (
          <Text style={styles.meta}>
            {formatInspectTime(viewing.startTime)} ? {formatInspectTime(viewing.endTime)}
          </Text>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}

        {!live && !ended ? (
          <>
            <Text style={styles.body}>
              Start the open inspection to open check-in and application links for prospects.
            </Text>
            <Pressable
              onPress={() => {
                void start();
              }}
              disabled={!canStart || busy != null}
              style={[styles.primary, (!canStart || busy != null) && styles.disabled]}
            >
              {busy === 'start' ? (
                <ActivityIndicator color={colors.primaryFg} />
              ) : (
                <Text style={styles.primaryText}>
                  {startEarly ? 'Start early' : 'Start open inspection'}
                </Text>
              )}
            </Pressable>
          </>
        ) : null}

        {live && !ended ? (
          <>
            <View style={styles.countdown}>
              <View style={styles.ringWrap}>
                <View style={styles.ringTrack} />
                <View style={[styles.ringFill, { width: `${Math.round(remainingRatio * 100)}%` }]} />
              </View>
              <Text style={styles.clock}>{clock}</Text>
              <Text style={styles.muted}>remaining</Text>
            </View>
            <Text style={styles.live}>Open now - Ends {viewing ? formatDateTime(viewing.endTime) : ''}</Text>
            <Text style={styles.body}>
              Finish early anytime during the viewing, or this job completes automatically when the
              window ends.
            </Text>
            <OpenInspectionHelpCard />
            <View style={styles.tabs}>
              <Pressable onPress={() => setTab('checkins')} style={[styles.tab, tab === 'checkins' && styles.tabOn]}>
                <Text style={[styles.tabText, tab === 'checkins' && styles.tabTextOn]}>Check-ins</Text>
              </Pressable>
              <Pressable onPress={() => setTab('qr')} style={[styles.tab, tab === 'qr' && styles.tabOn]}>
                <Text style={[styles.tabText, tab === 'qr' && styles.tabTextOn]}>QR & Links</Text>
              </Pressable>
            </View>
            {viewing ? <OpenViewingPanels viewing={viewing} panel={tab} /> : null}
            {viewing?.canCompleteEarly ? (
              <Pressable
                onPress={() => {
                  void finish(true);
                }}
                disabled={busy != null}
                style={[styles.primary, busy != null && styles.disabled]}
              >
                {busy === 'complete' ? (
                  <ActivityIndicator color={colors.primaryFg} />
                ) : (
                  <Text style={styles.primaryText}>End open inspection</Text>
                )}
              </Pressable>
            ) : null}
          </>
        ) : null}

        {returnPending ? (
          <>
            <Text style={styles.banner}>
              The viewing has ended. Hand the keys back - the job is only complete after that handover
              is recorded.
            </Text>
            <Pressable
              onPress={() => {
                if (onChangeTab) onChangeTab('handover', { keys: 'return' });
                else router.replace(`/jobs/${id}?tab=handover&keys=return` as never);
              }}
              style={styles.primary}
            >
              <Text style={styles.primaryText}>Continue to handover</Text>
            </Pressable>
          </>
        ) : null}

        {job.status === 'assigned' || job.status === 'in_progress' ? (
          <Pressable onPress={() => setCancelOpen(true)} style={styles.dangerBtn}>
            <Text style={styles.dangerText}>Cancel task</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      <CancelTaskSheet
        visible={cancelOpen}
        inspectionId={id}
        urgent={job.priority === 'urgent'}
        onClose={() => setCancelOpen(false)}
        onReleased={() => {
          setCancelOpen(false);
          void refresh();
          router.replace('/pool');
        }}
      />
      {Celebration}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 10 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  muted: { color: colors.muted, fontSize: 12 },
  meta: { color: colors.text, fontWeight: '600' },
  live: { color: colors.primary, fontWeight: '700' },
  clock: { color: colors.text, fontSize: 36, fontWeight: '700' },
  error: { color: colors.destructive, fontSize: 13 },
  banner: {
    color: colors.amber,
    backgroundColor: colors.amberBg,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTitle: { color: colors.text, fontWeight: '700' },
  visitor: { gap: 2, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border },
  visitorName: { color: colors.text, fontWeight: '600' },
  qr: { width: 180, height: 180, alignSelf: 'center', backgroundColor: '#ffffff', borderRadius: 8 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: colors.primary },
  tabText: { color: colors.muted, fontWeight: '600' },
  tabTextOn: { color: colors.primary },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: colors.primaryFg, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  disabled: { opacity: 0.55 },
  dangerBtn: { paddingVertical: 12, alignItems: 'center' },
  dangerText: { color: colors.destructive, fontWeight: '600' },
  helpHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  helpBody: { gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 },
  link: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  countdown: { alignItems: 'center', gap: 6, paddingVertical: 8 },
  ringWrap: {
    width: '100%',
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.secondary,
    overflow: 'hidden',
  },
  ringTrack: { ...StyleSheet.absoluteFill },
  ringFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 99 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
});
