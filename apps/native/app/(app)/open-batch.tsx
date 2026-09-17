import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  confirmOpenBatch,
  fetchOpenBatch,
  fetchOpenBatchPlan,
  releaseOpenBatch,
  selectOpenBatch,
  type OpenBatchOverview,
  type OpenBatchPlan,
  type OpenBatchTimeOverride,
} from '@/src/api/inspector';
import { useAccount } from '@/src/account/account-context';
import {
  OPEN_BATCH_EMPTY,
  OPEN_BATCH_STATE,
  OPEN_ROUTE_BASIS_NOTE,
  OPEN_TIME_PENDING_LABEL,
} from '@/src/constants/open-batch';
import { useInspections } from '@/src/inspections/inspections-context';
import { inspectorLevelAllows } from '@/src/lib/inspector-access-level';
import {
  formatDuration,
  formatOpenDate,
  formatOpenDeadline,
  formatOpenTime,
  formatPlanWindow,
  fromSydneyInputValue,
  stopsMissingAgentPreference,
  toSydneyInputValue,
} from '@/src/lib/open-batch';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { DateTimeField } from '@/src/ui/date-field';
import { EmptyState } from '@/src/ui/empty-state';

export default function OpenBatchScreen() {
  const { accessLevel } = useAccount();
  const { receivingJobs } = useInspections();
  const canOpen = inspectorLevelAllows(accessLevel, 'open');
  const [overview, setOverview] = useState<OpenBatchOverview | null>(null);
  const [plan, setPlan] = useState<OpenBatchPlan | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const batch = await fetchOpenBatch();
      let current: OpenBatchPlan | null = null;
      try {
        current = await fetchOpenBatchPlan();
      } catch {
        current = null;
      }
      setOverview(batch);
      setPlan(current);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the open pool.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canOpen) {
      setLoading(false);
      return;
    }
    void load();
  }, [canOpen, load]);

  const togglePick = (inspectionId: string) => {
    setPicked((prior) => {
      const next = new Set(prior);
      if (next.has(inspectionId)) next.delete(inspectionId);
      else next.add(inspectionId);
      return next;
    });
  };

  const submitSelection = async () => {
    if (picked.size === 0 || !overview) return;
    setBusy(true);
    try {
      const routed = await selectOpenBatch([...picked]);
      setPlan(routed);
      setPicked(new Set());
      if (routed.overflow.length > 0) {
        Alert.alert(
          `${routed.overflow.length} did not fit the day`,
          routed.overflow.map((item) => item.address).join(', '),
        );
      } else {
        Alert.alert('Route planned', `Routed ${routed.stops.length} opens — check the times below.`);
      }
      await load();
    } catch (err) {
      Alert.alert('Could not submit', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const submitConfirm = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const overrides: OpenBatchTimeOverride[] = [];
      for (const [inspectionId, value] of Object.entries(edits)) {
        const iso = fromSydneyInputValue(value);
        if (!iso) {
          Alert.alert('Invalid time', 'One of the edited times is not a valid time.');
          setBusy(false);
          return;
        }
        overrides.push({ inspectionId, startTime: iso });
      }
      await confirmOpenBatch(overrides);
      setEdits({});
      Alert.alert('Open times confirmed', 'The agents have been told.');
      await load();
    } catch (err) {
      Alert.alert('Could not confirm', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const dropStop = async (inspectionId: string) => {
    setBusy(true);
    try {
      const remaining = await releaseOpenBatch([inspectionId]);
      setPlan(remaining);
      Alert.alert('Returned to the pool');
      await load();
    } catch (err) {
      Alert.alert('Could not release', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const missedPreferences = useMemo(
    () => (plan ? stopsMissingAgentPreference(plan) : []),
    [plan],
  );
  const selectable = Boolean(overview?.selectable) && receivingJobs;
  const atLimit =
    overview !== null && (plan?.stops.length ?? 0) + picked.size >= overview.maxSelectable;
  const allConfirmed = Boolean(plan?.confirmed);
  const bannerTone =
    overview?.state === OPEN_BATCH_STATE.SELECTING
      ? styles.bannerSelect
      : overview?.state === OPEN_BATCH_STATE.PAST_DEADLINE
        ? styles.bannerLate
        : styles.bannerMuted;

  return (
    <View style={styles.safe}>
      <AppHeader title="Open Task Pool" backHref="/pool" />
      <ScrollView
        contentContainerStyle={styles.inner}
        refreshControl={
          <RefreshControl
            refreshing={loading && overview != null}
            onRefresh={() => {
              if (canOpen) void load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {!canOpen ? (
          <EmptyState
            icon="git-branch-outline"
            title="Open inspections not available"
            description="The open task pool is available from Level 3."
          />
        ) : (
          <>
            {overview ? (
              <View style={[styles.banner, bannerTone]}>
                <Text style={styles.bannerTitle}>{overview.stateLabel}</Text>
                <Text style={styles.meta}>Opens run {formatOpenDate(overview.viewingDate)}</Text>
                <Text style={styles.meta}>
                  {overview.state === OPEN_BATCH_STATE.ACCUMULATING
                    ? `Selection opens ${formatOpenDeadline(overview.selectionOpensAt)}`
                    : `Confirm by ${formatOpenDeadline(overview.finalizeBy)}`}
                </Text>
              </View>
            ) : null}

            {error ? (
              <EmptyState
                icon="warning-outline"
                title="Could not load the open pool"
                description={error}
              />
            ) : loading && !overview ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
            ) : (
              <>
                {plan && plan.stops.length > 0 ? (
                  <View style={styles.section}>
                    <View style={styles.sectionHead}>
                      <Text style={styles.kicker}>Your Saturday</Text>
                      <Text style={styles.meta}>{formatPlanWindow(plan)}</Text>
                    </View>
                    <Text style={styles.meta}>
                      {plan.stops.length} opens · {formatDuration(plan.totalTravelMinutes)} travel
                      {plan.totalDistanceKm != null ? ` · ${plan.totalDistanceKm} km` : ''}
                    </Text>
                    {missedPreferences.length > 0 && !allConfirmed ? (
                      <Text style={styles.warn}>
                        {missedPreferences.length}{' '}
                        {missedPreferences.length === 1 ? 'agent' : 'agents'} asked for a different
                        time. They will be told the confirmed time. Nudge a slot if you can make
                        theirs work.
                      </Text>
                    ) : null}
                    {plan.stops.map((stop) => {
                      const editing = edits[stop.inspectionId];
                      const basisNote = OPEN_ROUTE_BASIS_NOTE[stop.basis];
                      return (
                        <View key={stop.inspectionId} style={styles.card}>
                          <View style={styles.stopRow}>
                            <View style={styles.seq}>
                              <Text style={styles.seqText}>{stop.sequence}</Text>
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.address}>{stop.address}</Text>
                              <Text style={styles.time}>{formatOpenTime(stop.startTime)}</Text>
                              {stop.travelMinutesFromPrevious > 0 ? (
                                <Text style={styles.meta}>
                                  {formatDuration(stop.travelMinutesFromPrevious)} travel
                                  {stop.distanceKmFromPrevious != null
                                    ? ` · ${stop.distanceKmFromPrevious} km`
                                    : ''}
                                </Text>
                              ) : null}
                              {basisNote ? <Text style={styles.italic}>{basisNote}</Text> : null}
                              {stop.confirmedAt ? (
                                <Text style={styles.confirmed}>Confirmed — agent notified</Text>
                              ) : null}
                            </View>
                          </View>
                          {!stop.confirmedAt ? (
                            <View style={styles.editRow}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <DateTimeField
                                  value={editing ?? toSydneyInputValue(stop.startTime)}
                                  onChange={(value) =>
                                    setEdits((prior) => ({ ...prior, [stop.inspectionId]: value }))
                                  }
                                  placeholder="Pick date and time"
                                />
                              </View>
                              <Pressable
                                disabled={busy}
                                onPress={() => void dropStop(stop.inspectionId)}
                              >
                                <Text style={styles.drop}>Drop</Text>
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                    {!allConfirmed ? (
                      <Pressable
                        disabled={busy}
                        onPress={() => void submitConfirm()}
                        style={[styles.cta, busy && styles.ctaOff]}
                      >
                        <Text style={styles.ctaText}>
                          {Object.keys(edits).length > 0
                            ? 'Save times and confirm'
                            : 'Confirm these times'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.kicker}>Waiting to be opened</Text>
                    {overview ? (
                      <Text style={styles.meta}>{overview.available.length} available</Text>
                    ) : null}
                  </View>
                  {!receivingJobs ? (
                    <EmptyState
                      icon="git-branch-outline"
                      title={OPEN_BATCH_EMPTY.NOT_RECEIVING.title}
                      description={OPEN_BATCH_EMPTY.NOT_RECEIVING.description}
                    />
                  ) : overview && overview.available.length === 0 ? (
                    <EmptyState
                      icon="git-branch-outline"
                      title={
                        overview.takenByOthers > 0
                          ? OPEN_BATCH_EMPTY.ALL_TAKEN.title
                          : OPEN_BATCH_EMPTY.NO_PROPERTIES.title
                      }
                      description={
                        overview.takenByOthers > 0
                          ? OPEN_BATCH_EMPTY.ALL_TAKEN.description
                          : OPEN_BATCH_EMPTY.NO_PROPERTIES.description
                      }
                    />
                  ) : (
                    overview?.available.map((item) => {
                      const chosen = picked.has(item.inspectionId);
                      const disabled = !selectable || (atLimit && !chosen);
                      return (
                        <Pressable
                          key={item.inspectionId}
                          disabled={disabled}
                          onPress={() => togglePick(item.inspectionId)}
                          style={[
                            styles.card,
                            chosen && styles.cardOn,
                            disabled && styles.cardOff,
                          ]}
                        >
                          <View style={styles.stopRow}>
                            <View style={[styles.check, chosen && styles.checkOn]}>
                              {chosen ? (
                                <Ionicons name="checkmark" size={14} color={colors.primaryFg} />
                              ) : null}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.address}>{item.address}</Text>
                              <Text style={styles.meta}>
                                {item.timeProvisional
                                  ? OPEN_TIME_PENDING_LABEL
                                  : item.suggestedStart
                                    ? formatOpenTime(item.suggestedStart)
                                    : OPEN_TIME_PENDING_LABEL}
                                {item.agentPreferredStart
                                  ? ` · agent asked ${formatOpenTime(item.agentPreferredStart)}`
                                  : ''}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                  {picked.size > 0 ? (
                    <Pressable
                      disabled={busy || !selectable}
                      onPress={() => void submitSelection()}
                      style={[styles.cta, (busy || !selectable) && styles.ctaOff]}
                    >
                      <Text style={styles.ctaText}>
                        Submit {picked.size} {picked.size === 1 ? 'property' : 'properties'} and
                        plan my route
                      </Text>
                    </Pressable>
                  ) : null}
                  {overview && !overview.selectable && receivingJobs ? (
                    <Text style={styles.centerMeta}>
                      You can pick from {formatOpenDeadline(overview.selectionOpensAt)}.
                    </Text>
                  ) : null}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 16 },
  banner: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 4 },
  bannerMuted: { borderColor: colors.border, backgroundColor: colors.card },
  bannerSelect: {
    borderColor: 'rgba(0,212,164,0.4)',
    backgroundColor: 'rgba(0,212,164,0.1)',
  },
  bannerLate: {
    borderColor: 'rgba(239,68,68,0.4)',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  bannerTitle: { color: colors.text, fontSize: 12, fontWeight: '700' },
  section: { gap: 10 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardOn: { borderColor: colors.primary, backgroundColor: 'rgba(0,212,164,0.08)' },
  cardOff: { opacity: 0.55 },
  stopRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  seq: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seqText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  address: { color: colors.text, fontSize: 14, fontWeight: '500' },
  time: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  meta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  italic: { color: colors.muted, fontSize: 10, fontStyle: 'italic', marginTop: 4 },
  confirmed: { color: colors.primary, fontSize: 10, fontWeight: '600', marginTop: 4 },
  warn: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  drop: { color: colors.destructive, fontSize: 13, fontWeight: '600' },
  check: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaOff: { opacity: 0.45 },
  ctaText: { color: colors.primaryFg, fontWeight: '700' },
  centerMeta: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
