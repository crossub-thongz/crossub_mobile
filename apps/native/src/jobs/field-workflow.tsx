import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  acceptInspection,
  clearInspectionAreaPhotos,
  completeInspection,
  fetchInspectionDetail,
} from '@/src/api/inspector';
import { getDeviceId } from '@/src/auth/session';
import { INSPECTION_PAY_LABEL, isCoreInspectionType } from '@/src/constants/inspection';
import { useInspections } from '@/src/inspections/inspections-context';
import { AreaSetupPanel } from '@/src/jobs/area-setup-panel';
import { CancelTaskSheet } from '@/src/jobs/cancel-task-sheet';
import { ChecklistWalk } from '@/src/jobs/checklist-walk';
import { compressPhotoForUpload, type LocalPhoto } from '@/src/jobs/compress-photo';
import { JobCamera } from '@/src/jobs/job-camera';
import { JobWorkspaceNav } from '@/src/jobs/workspace-nav';
import {
  appendSelectedAreaName,
  classifyAddedAreaName,
  omitNamedRecordKey,
  removeSelectedAreaName,
  type CustomAreaSectionMode,
} from '@/src/lib/custom-inspection-areas';
import { attendanceWindowFromHours, routineFindingsPayload } from '@/src/lib/findings';
import { inspectionStartCopy, layoutSourceLabel, preInspectionSmsHref } from '@/src/lib/inspection-start-flow';
import {
  draftNeedsLayoutSeed,
  emptyRoutineIssue,
  layoutTemplateFromProperty,
  roomsFromIngoingDetail,
  seedAreasForStart,
} from '@/src/lib/inspection-layout';
import { moveIndex, rekeyRecord, renameCustomArea } from '@/src/lib/inspection-layout-edit';
import { isKeyCollectComplete } from '@/src/lib/key-access';
import { queueExecutionDraft, queueInspectionFindings, queueInspectionPhoto } from '@/src/offline/sync';
import { useOffline } from '@/src/offline/offline-context';
import { jobDetail, jobInspect, jobKeys } from '@/src/lib/routes';
import type { InspectionType, RoutineExecutionDraft } from '@/src/lib/types';
import { colors } from '@/src/theme';

function parseView(value: string | string[] | undefined): 'areas' | 'inspect' {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'inspect' ? 'inspect' : 'areas';
}

export function FieldWorkflowScreen({ type }: { type: InspectionType }) {
  const { id, view: viewParam } = useLocalSearchParams<{ id: string; view?: string }>();
  const router = useRouter();
  const { getJob, getDraft, setDraft, patchJob, upsertJob, refresh } = useInspections();
  const { refreshPending } = useOffline();
  const job = getJob(id);
  const view = type === 'open' ? 'inspect' : parseView(viewParam);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layoutSource, setLayoutSource] = useState<'template' | 'copied' | 'manual'>('template');
  const [existingAreas, setExistingAreas] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const kind = type === 'ingoing' || type === 'outgoing' ? type : 'routine';
  const stored = (id ? getDraft(id) : undefined) ?? null;

  const draft: RoutineExecutionDraft = stored ?? {
    kind,
    areaIndex: 0,
    method: 'physical',
    issues: {},
    selectedAreaNames: undefined,
    areaSetupComplete: false,
  };

  const persist = useCallback(
    (next: RoutineExecutionDraft) => {
      if (!id) return;
      const stamped = { ...next, updatedAt: new Date().toISOString() };
      setDraft(id, stamped);
      void (async () => {
        try {
          const deviceId = await getDeviceId();
          await queueExecutionDraft(id, {
            deviceId,
            kind,
            updatedAt: stamped.updatedAt,
            draft: stamped as unknown as Record<string, unknown>,
          });
          void refreshPending();
        } catch {
          // SQLite still holds the draft.
        }
      })();
    },
    [id, kind, setDraft, refreshPending],
  );

  useEffect(() => {
    if (!id || !job) return;
    if (job.awaitingAgentPayment) {
      router.replace(jobDetail(id));
      return;
    }
    if (job.keyAccess && !isKeyCollectComplete(job)) {
      router.replace(jobKeys(id, 'collect'));
    }
  }, [id, job, router]);

  useEffect(() => {
    if (!id || !job || stored?.areaSetupComplete) return;
    void (async () => {
      try {
        const detail = await fetchInspectionDetail(id);
        const copied = roomsFromIngoingDetail(detail);
        const template = layoutTemplateFromProperty(job.property);
        const base = stored ?? draft;
        if (!draftNeedsLayoutSeed(base)) return;
        if (copied.length > 0) {
          setExistingAreas(copied);
          persist({ ...base, selectedAreaNames: copied, issues: seedAreasForStart(base.issues, copied, base.customAreas) });
          setLayoutSource('copied');
        } else {
          persist({ ...base, selectedAreaNames: template, issues: seedAreasForStart(base.issues, template, base.customAreas) });
          setLayoutSource('template');
        }
      } catch {
        const template = layoutTemplateFromProperty(job.property);
        persist({ ...draft, selectedAreaNames: template });
      }
    })();
    // Seed once per job when the draft has never been laid out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, job?.id]);

  const names = draft.selectedAreaNames ?? [];
  const areaIndex = Math.min(draft.areaIndex, Math.max(names.length - 1, 0));
  const currentName = names[areaIndex];
  const current = currentName ? draft.issues[currentName] ?? emptyRoutineIssue() : emptyRoutineIssue();
  const copy = isCoreInspectionType(type) ? inspectionStartCopy(type) : inspectionStartCopy('routine');
  const sms = job ? preInspectionSmsHref(job) : null;

  const ensureAccepted = async () => {
    if (!job || !id) throw new Error('Job is not loaded.');
    if (job.status === 'in_progress') return;
    if (job.status !== 'assigned') return;
    const dto = await acceptInspection(id);
    upsertJob({ ...job, status: 'in_progress', id: dto.id });
  };

  const completeSetup = () => {
    if (names.length === 0) {
      setError('Add at least one area, then start the inspection.');
      return;
    }
    persist({
      ...draft,
      areaSetupComplete: true,
      areaIndex: 0,
      issues: seedAreasForStart(draft.issues, names, draft.customAreas ?? []),
    });
    if (id) router.replace(jobInspect(id, type) as never);
  };

  const handleAddCustomArea = (name: string, sectionMode: CustomAreaSectionMode) => {
    const classified = classifyAddedAreaName(name);
    const setupComplete = draft.areaSetupComplete === true;
    let nextCustom = draft.customAreas ?? [];
    if (classified.kind === 'custom') {
      const exists = nextCustom.some(
        (area) => area.name.trim().toLowerCase() === classified.name.toLowerCase(),
      );
      if (!exists) nextCustom = [...nextCustom, { name: classified.name, sectionMode }];
    }
    const nextSelected = appendSelectedAreaName(draft.selectedAreaNames, classified.name);
    let nextIssues = {
      ...draft.issues,
      [classified.name]: draft.issues[classified.name] ?? emptyRoutineIssue(),
    };
    if (setupComplete) {
      nextIssues = seedAreasForStart(nextIssues, [classified.name], nextCustom);
    }
    persist({
      ...draft,
      customAreas: nextCustom,
      selectedAreaNames: nextSelected,
      areaIndex: setupComplete
        ? Math.max(0, nextSelected.findIndex((item) => item === classified.name))
        : draft.areaIndex,
      issues: nextIssues,
    });
  };

  const handleRemoveSetupArea = (name: string) => {
    const nextSelected = removeSelectedAreaName(draft.selectedAreaNames, name);
    persist({
      ...draft,
      selectedAreaNames: nextSelected,
      customAreas: (draft.customAreas ?? []).filter(
        (item) => item.name.trim().toLowerCase() !== name.trim().toLowerCase(),
      ),
      issues: omitNamedRecordKey(draft.issues, name),
      areaIndex: Math.min(draft.areaIndex, Math.max(nextSelected.length - 1, 0)),
    });
  };

  const handleMoveSetupArea = (from: number, to: number) => {
    persist({
      ...draft,
      selectedAreaNames: moveIndex(names, from, to),
    });
  };

  const handleRenameSetupArea = (from: string, to: string) => {
    if (from === to) return;
    persist({
      ...draft,
      selectedAreaNames: names.map((name) => (name === from ? to : name)),
      customAreas: renameCustomArea(draft.customAreas ?? [], from, to),
      issues: rekeyRecord(draft.issues, from, to),
    });
  };

  const addAllFromIngoing = () => {
    const extras = existingAreas.filter(
      (name) => !names.some((selected) => selected.toLowerCase() === name.toLowerCase()),
    );
    if (extras.length === 0) return;
    const nextIssues = { ...draft.issues };
    for (const name of extras) {
      if (!nextIssues[name]) nextIssues[name] = emptyRoutineIssue();
    }
    persist({
      ...draft,
      selectedAreaNames: [...names, ...extras],
      issues: nextIssues,
    });
  };

  const resetInspection = () => {
    Alert.alert(
      'Reset inspection?',
      'This clears your area checklist, section progress, and uploaded photos for this inspection on this device. You will start again from area setup.',
      [
        { text: 'Keep progress', style: 'cancel' },
        {
          text: 'Reset inspection',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!id) return;
              setBusy('reset');
              try {
                try {
                  const detail = await fetchInspectionDetail(id);
                  const areaNames = [
                    ...new Set(
                      (detail.areas ?? [])
                        .map((area) => area.name?.trim())
                        .filter((name): name is string => Boolean(name)),
                    ),
                  ];
                  await Promise.all(areaNames.map((areaName) => clearInspectionAreaPhotos(id, areaName)));
                } catch {
                  // Local reset still applies.
                }
                const blank: RoutineExecutionDraft = {
                  kind,
                  areaIndex: 0,
                  method: 'physical',
                  issues: {},
                  selectedAreaNames: existingAreas.length
                    ? existingAreas
                    : job
                      ? layoutTemplateFromProperty(job.property)
                      : [],
                  customAreas: [],
                  areaSetupComplete: false,
                };
                persist(blank);
                setLayoutSource(existingAreas.length ? 'copied' : 'template');
                if (id) router.replace(`/jobs/${id}/${type}` as never);
              } finally {
                setBusy(null);
              }
            })();
          },
        },
      ],
    );
  };

  const goArea = (index: number) => {
    persist({ ...draft, areaIndex: Math.max(0, Math.min(index, names.length - 1)) });
  };

  const onBurst = async (photos: LocalPhoto[]) => {
    if (!id || !currentName || photos.length === 0) return;
    setBusy('photo');
    setError(null);
    try {
      await ensureAccepted();
      const urls: string[] = [];
      for (const photo of photos) {
        const body = await compressPhotoForUpload(photo);
        const uploaded = await queueInspectionPhoto(id, { ...body, areaName: currentName }, photo.uri);
        urls.push(uploaded.url);
      }
      persist({
        ...draft,
        issues: {
          ...draft.issues,
          [currentName]: {
            ...current,
            available: true as const,
            areaPhotos: [...current.areaPhotos, ...urls],
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed — please retry');
    } finally {
      setBusy(null);
    }
  };

  const skipArea = () => {
    if (!currentName) return;
    persist({
      ...draft,
      issues: {
        ...draft.issues,
        [currentName]: { ...current, available: false, areaPhotos: [] },
      },
      areaIndex: areaIndex < names.length - 1 ? areaIndex + 1 : areaIndex,
    });
  };

  const nextArea = async () => {
    if (!currentName) return;
    if (current.available !== true && current.available !== false) {
      setError('Confirm whether this area is available');
      return;
    }
    if (current.available === true && current.areaPhotos.length === 0) {
      setError('Snap at least one photo of this room');
      return;
    }
    if (areaIndex >= names.length - 1) {
      await finalize();
      return;
    }
    goArea(areaIndex + 1);
  };

  const finalize = async () => {
    if (!id || !job) return;
    setBusy('complete');
    setError(null);
    try {
      await ensureAccepted();
      const payload = routineFindingsPayload(draft.method, names, draft.issues);
      const findingsState = await queueInspectionFindings(id, payload);
      void refreshPending();
      if (findingsState === 'queued') {
        Alert.alert(
          'Saved on this phone',
          'Findings will upload when you are back online. Open Settings and tap Sync now, then complete the report.',
        );
        return;
      }
      if (job.keyAccess && !job.keyAccess.returnComplete && kind === 'routine') {
        patchJob(id, {
          workflowData: { ...job.workflowData, inspectionFinished: true },
        });
        Alert.alert('Report generated', 'Return the keys to complete this task.');
        router.replace(jobKeys(id, 'return') as never);
        return;
      }
      const completed = await completeInspection(id, attendanceWindowFromHours(job.estimatedHours));
      upsertJob({ ...job, status: completed.status === 'COMPLETED' ? 'completed' : job.status });
      await refresh();
      Alert.alert('Inspection complete', 'Routine report sent to agent and landlord.', [
        { text: 'Home', onPress: () => router.replace('/') },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The findings could not be saved. Check your connection and complete the report again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const sourceLabel = useMemo(
    () => layoutSourceLabel(layoutSource, names.length),
    [layoutSource, names.length],
  );

  if (!job || !id) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.error}>This job could not be found.</Text>
      </SafeAreaView>
    );
  }

  const title = `${INSPECTION_PAY_LABEL[job.type] ?? job.type} Inspection`;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title, headerBackTitle: 'Back' }} />
      <JobWorkspaceNav job={job} active={view === 'areas' ? 'areas' : 'start'} />
      {view === 'inspect' && (type === 'ingoing' || type === 'outgoing') ? (
        <View style={styles.flex}>
          <Pressable onPress={() => setCancelOpen(true)} style={styles.cancelLink}>
            <Text style={styles.cancelLinkText}>Cancel task</Text>
          </Pressable>
          <ChecklistWalk
            inspectionId={id}
            type={type}
            draft={draft}
            persist={persist}
            names={names}
            areaIndex={areaIndex}
            goArea={goArea}
            ensureAccepted={ensureAccepted}
            busy={busy}
            setBusy={setBusy}
            error={error}
            setError={setError}
            customAreas={draft.customAreas ?? []}
            onAfterFindings={async () => {
              if (job.keyAccess && !job.keyAccess.returnComplete) {
                patchJob(id, {
                  workflowData: { ...job.workflowData, inspectionFinished: true },
                });
                Alert.alert('Report generated', 'Return the keys to complete this task.');
                router.replace(jobKeys(id, 'return') as never);
                return;
              }
              const completed = await completeInspection(
                id,
                attendanceWindowFromHours(job.estimatedHours),
              );
              upsertJob({
                ...job,
                status: completed.status === 'COMPLETED' ? 'completed' : job.status,
              });
              await refresh();
              Alert.alert(
                'Inspection complete',
                `${INSPECTION_PAY_LABEL[job.type] ?? job.type} report sent to agent and landlord.`,
                [{ text: 'Home', onPress: () => router.replace('/') }],
              );
            }}
          />
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {view === 'inspect' ? (
          <Pressable onPress={() => setCancelOpen(true)}>
            <Text style={styles.cancelLinkText}>Cancel task</Text>
          </Pressable>
        ) : null}

        {view === 'areas' ? (
          <>
            <Text style={styles.title}>{copy.startLabel.replace(/^(Start|Continue) /, '')}</Text>
            <Text style={styles.body}>{copy.body}</Text>
            <Pressable onPress={resetInspection} style={styles.secondary}>
              <Text style={styles.cancelLinkText}>Reset inspection</Text>
            </Pressable>
            <AreaSetupPanel
              kind={kind}
              selectedAreaNames={names}
              existingAreaNames={existingAreas}
              continuing={Boolean(draft.areaSetupComplete || names.length > 0 || areaIndex > 0)}
              sourceLabel={sourceLabel}
              extraHeader={
                <>
                  {type === 'routine' ? (
                    <View style={styles.methodRow}>
                      {(['physical', 'self'] as const).map((method) => (
                        <Pressable
                          key={method}
                          onPress={() => persist({ ...draft, method })}
                          style={[styles.chip, draft.method === method && styles.chipOn]}
                        >
                          <Text style={[styles.chipText, draft.method === method && styles.chipTextOn]}>
                            {method === 'physical' ? 'Physical' : 'Tenant self-inspect'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  {sms ? (
                    <Pressable onPress={() => void Linking.openURL(sms)} style={styles.secondary}>
                      <Text style={styles.secondaryText}>SMS tenant reminder</Text>
                    </Pressable>
                  ) : null}
                </>
              }
              onAddBuiltInArea={(name) => handleAddCustomArea(name, 'standard')}
              onAddCustomArea={handleAddCustomArea}
              onRemoveArea={handleRemoveSetupArea}
              onRenameArea={handleRenameSetupArea}
              onMoveArea={handleMoveSetupArea}
              onAddAllExisting={existingAreas.length > 0 ? addAllFromIngoing : undefined}
              onComplete={completeSetup}
            />
          </>
        ) : (
          <>
            {names.length === 0 ? (
              <Text style={styles.body}>No areas selected for this inspection.</Text>
            ) : (
              <>
                <View style={styles.pips}>
                  {names.map((name, index) => {
                    const rec = draft.issues[name];
                    const done = rec?.available === false || (rec?.areaPhotos.length ?? 0) > 0;
                    return (
                      <Pressable
                        key={name}
                        onPress={() => goArea(index)}
                        style={[
                          styles.pip,
                          index === areaIndex && styles.pipOn,
                          done && styles.pipDone,
                        ]}
                      />
                    );
                  })}
                </View>
                <Text style={styles.kicker}>
                  Area {areaIndex + 1} of {names.length}
                </Text>
                <Text style={styles.title}>{currentName}</Text>
                {current.available === false ? (
                  <Text style={styles.banner}>
                    This area was marked unavailable. You can change that and photograph it, or continue.
                  </Text>
                ) : (
                  <Text style={styles.body}>
                    Photograph the room as it is now. Add notes if anything needs attention.
                  </Text>
                )}
                <TextInput
                  value={current.notes}
                  onChangeText={(notes) => {
                    if (!currentName) return;
                    persist({
                      ...draft,
                      issues: {
                        ...draft.issues,
                        [currentName]: { ...current, notes, available: current.available ?? true },
                      },
                    });
                  }}
                  placeholder="Notes"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={[styles.input, styles.notes]}
                />
                {current.areaPhotos[0] ? (
                  <Image source={{ uri: current.areaPhotos[0] }} style={styles.thumb} />
                ) : null}
                <Text style={styles.meta}>
                  {current.areaPhotos.length} photo{current.areaPhotos.length === 1 ? '' : 's'}
                </Text>
                <Pressable onPress={() => setCameraOpen(true)} style={styles.secondary}>
                  <Text style={styles.secondaryText}>
                    {busy === 'photo' ? 'Uploading photos…' : 'Take photos'}
                  </Text>
                </Pressable>
                <Pressable onPress={skipArea} style={styles.secondary}>
                  <Text style={styles.secondaryText}>Skip this area instead</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void nextArea();
                  }}
                  disabled={busy != null}
                  style={[styles.primary, busy != null && styles.disabled]}
                >
                  {busy === 'complete' ? (
                    <ActivityIndicator color={colors.primaryFg} />
                  ) : (
                    <Text style={styles.primaryText}>
                      {areaIndex >= names.length - 1 ? 'Complete' : 'Next area'}
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
      )}
      <JobCamera
        visible={cameraOpen}
        mode="burst"
        onClose={() => setCameraOpen(false)}
        onBurstComplete={(photos) => {
          void onBurst(photos);
        }}
      />
      <CancelTaskSheet
        visible={cancelOpen}
        inspectionId={id}
        urgent={job.priority === 'urgent'}
        onClose={() => setCancelOpen(false)}
        onReleased={() => {
          setCancelOpen(false);
          void refresh();
          router.replace('/');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: '700' },
  kicker: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  banner: {
    color: colors.amber,
    backgroundColor: colors.amberBg,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
    overflow: 'hidden',
  },
  error: { color: colors.destructive, fontSize: 13 },
  methodRow: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  chipTextOn: { color: colors.primaryFg },
  areaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
  },
  areaName: { color: colors.text, fontWeight: '600' },
  remove: { color: colors.destructive, fontSize: 12, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  addBtn: {
    backgroundColor: colors.secondary,
    borderRadius: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addBtnText: { color: colors.text, fontWeight: '700' },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { color: colors.primaryFg, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  pips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pip: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary },
  pipOn: { backgroundColor: colors.primary },
  pipDone: { backgroundColor: '#34d399' },
  thumb: { height: 160, borderRadius: 8, backgroundColor: colors.card },
  meta: { color: colors.muted, fontSize: 12 },
  disabled: { opacity: 0.55 },
  flex: { flex: 1 },
  cancelLink: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingTop: 8 },
  cancelLinkText: { color: colors.destructive, fontSize: 13, fontWeight: '600' },
});
