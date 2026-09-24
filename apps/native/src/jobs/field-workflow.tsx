import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';

import { apiErrorMessage } from '@/src/api/client';
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
import { INSPECTION_BURST_MAX, type LocalPhoto } from '@/src/jobs/compress-photo';
import { InspectionAreaActionBar } from '@/src/jobs/inspection-area-action-bar';
import { InspectionAreaNav } from '@/src/jobs/inspection-area-nav';
import { InspectionPhotosField } from '@/src/jobs/inspection-photos-field';
import { JobCamera } from '@/src/jobs/job-camera';
import { JobLookupFallback } from '@/src/jobs/job-lookup-fallback';
import { useFinishInspection } from '@/src/jobs/use-finish-inspection';
import { type WorkspaceTab } from '@/src/jobs/workspace-nav';
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
import { buildInspectionFinishedPatch, isKeyCollectComplete } from '@/src/lib/key-access';
import { jobLookupMiss } from '@/src/lib/job-lookup';
import { queueExecutionDraft, queueInspectionFindings, queueInspectionPhotoBatch } from '@/src/offline/sync';
import { upsertPhotoUrl } from '@/src/offline/queued-photo';
import { inspectionHasNswSpecialReporting } from '@/src/lib/special-reporting';
import { useOffline } from '@/src/offline/offline-context';
import { jobDetail, jobInspect, jobKeys } from '@/src/lib/routes';
import type { InspectionType, RoutineExecutionDraft } from '@/src/lib/types';
import { colors } from '@/src/theme';

function parseView(value: string | string[] | undefined): 'areas' | 'inspect' {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'inspect' ? 'inspect' : 'areas';
}

export function FieldWorkflowScreen({
  type,
  view: viewProp,
  onChangeTab,
}: {
  type: InspectionType;
  view?: 'areas' | 'inspect';
  onChangeTab?: (tab: WorkspaceTab, extras?: { keys?: 'collect' | 'return' }) => void;
}) {
  const { id, view: viewParam } = useLocalSearchParams<{ id: string; view?: string }>();
  const router = useRouter();
  const { getJob, getDraft, setDraft, patchJob, upsertJob, refresh, jobsHydrated, draftsHydrated } = useInspections();
  const { refreshPending } = useOffline();
  const job = getJob(id);
  const view = viewProp ?? (type === 'open' ? 'inspect' : parseView(viewParam));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layoutSource, setLayoutSource] = useState<'template' | 'copied' | 'manual'>('template');
  const [existingAreas, setExistingAreas] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [areasDragging, setAreasDragging] = useState(false);
  const { celebrate, Celebration } = useFinishInspection({
    onHome: () => router.replace('/'),
    onKeys: () => {
      if (onChangeTab) onChangeTab('handover', { keys: 'return' });
      else if (id) router.replace(jobKeys(id, 'return') as never);
    },
  });

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
      if (!id || !draftsHydrated) return;
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
    [id, kind, setDraft, refreshPending, draftsHydrated],
  );

  const names = draft.selectedAreaNames ?? [];
  const areaIndex = Math.min(draft.areaIndex, Math.max(names.length - 1, 0));
  const currentName = names[areaIndex];
  const current = currentName ? draft.issues[currentName] ?? emptyRoutineIssue() : emptyRoutineIssue();
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const getDraftRef = useRef(getDraft);
  getDraftRef.current = getDraft;

  useEffect(() => {
    if (!id || !job) return;
    if (onChangeTab) return;
    if (job.awaitingAgentPayment) {
      router.replace(jobDetail(id));
      return;
    }
    if (job.keyAccess && !isKeyCollectComplete(job)) {
      router.replace(jobKeys(id, 'collect'));
    }
  }, [id, job, onChangeTab, router]);

  useEffect(() => {
    if (!draftsHydrated || !id || !job || stored?.areaSetupComplete) return;
    void (async () => {
      try {
        const detail = await fetchInspectionDetail(id);
        const copied = roomsFromIngoingDetail(detail);
        const template = layoutTemplateFromProperty(job.property);
        const base = getDraftRef.current(id) ?? draftRef.current;
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
        const base = getDraftRef.current(id) ?? draftRef.current;
        if (!draftNeedsLayoutSeed(base)) return;
        persist({ ...base, selectedAreaNames: template });
      }
    })();
    // Seed once per job when the draft has never been laid out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, job?.id, draftsHydrated]);
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
    if (id) {
      if (onChangeTab) onChangeTab('start');
      else router.replace(jobInspect(id, type) as never);
    }
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
      await queueInspectionPhotoBatch(id, photos, currentName, (fromUri, toUri) => {
        const latest = draftRef.current.issues[currentName] ?? current;
        persist({
          ...draftRef.current,
          issues: {
            ...draftRef.current.issues,
            [currentName]: {
              ...latest,
              available: true as const,
              areaPhotos: upsertPhotoUrl(latest.areaPhotos ?? [], fromUri, toUri),
            },
          },
        });
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Photo upload failed - please retry'));
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
    });
  };

  const nextArea = async () => {
    if (!currentName) return;
    if (current.available !== true && current.available !== false) {
      setError('Confirm whether this area is available');
      return;
    }
    if (current.available === true && current.areaPhotos.length === 0) {
      setError('Snap at least one photo for this area');
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
        persist({ ...draft, inspectionFinished: true });
        patchJob(id, {
          workflowData: buildInspectionFinishedPatch(job.workflowData),
        });
        celebrate(
          'Return the keys to complete this task.',
          'keys',
          'Report generated',
        );
        return;
      }
      const completed = await completeInspection(id, attendanceWindowFromHours(job.estimatedHours));
      upsertJob({ ...job, status: completed.status === 'COMPLETED' ? 'completed' : job.status });
      await refresh();
      celebrate('Routine report sent to agent and landlord');
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
      <View style={styles.safe}>
        <JobLookupFallback state={jobLookupMiss(jobsHydrated && draftsHydrated)} />
      </View>
    );
  }

  if (!draftsHydrated) {
    return (
      <View style={styles.safe}>
        <JobLookupFallback state="loading" />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      {view === 'inspect' && inspectionHasNswSpecialReporting(type) ? (
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
                  workflowData: buildInspectionFinishedPatch(job.workflowData),
                });
                celebrate(
                  'Return the keys to complete this task.',
                  'keys',
                  'Report generated',
                );
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
              celebrate(
                `${INSPECTION_PAY_LABEL[job.type] ?? job.type} report sent for account manager review`,
                'home',
                'Awaiting approval',
              );
            }}
          />
        </View>
      ) : view === 'inspect' ? (
        <View style={styles.flex}>
          <Pressable onPress={() => setCancelOpen(true)} style={styles.cancelLink}>
            <Text style={styles.cancelLinkText}>Cancel task</Text>
          </Pressable>
          {names.length > 0 ? (
            <InspectionAreaNav
              names={names}
              areaIndex={areaIndex}
              isComplete={(_index, name) => {
                const rec = draft.issues[name];
                return rec?.available === false || (rec?.areaPhotos.length ?? 0) > 0;
              }}
              onGoToArea={goArea}
            />
          ) : null}
          {error ? <Text style={styles.errorPad}>{error}</Text> : null}
          <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" style={styles.flex}>
            {names.length === 0 ? (
              <Text style={styles.body}>No areas selected for this inspection.</Text>
            ) : current.available === false ? (
              <>
                <Text style={styles.body}>
                  This area was marked unavailable. You can change that and photograph it, or continue.
                </Text>
                <Pressable
                  onPress={() => {
                    if (!currentName) return;
                    persist({
                      ...draft,
                      issues: {
                        ...draft.issues,
                        [currentName]: { ...current, available: true },
                      },
                    });
                  }}
                  style={styles.secondary}
                >
                  <Text style={styles.secondaryText}>Mark available and photograph</Text>
                </Pressable>
              </>
            ) : (
              <>
                <InspectionPhotosField
                  label="Area photos"
                  photoUrls={current.areaPhotos ?? []}
                  uploading={busy === 'photo'}
                  disabled={busy === 'complete'}
                  emptyLabel="Snap or upload several photos of this room, then attach them here."
                  onTakePhotos={() => setCameraOpen(true)}
                  onAddPhotos={(photos) => {
                    void onBurst(photos);
                  }}
                  onRemove={(index) => {
                    if (!currentName) return;
                    persist({
                      ...draft,
                      issues: {
                        ...draft.issues,
                        [currentName]: {
                          ...current,
                          areaPhotos: current.areaPhotos.filter((_, i) => i !== index),
                        },
                      },
                    });
                  }}
                />
                <View>
                  <Text style={styles.notesLabel}>Area notes</Text>
                  <AppTextInput
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
                    placeholder={
                      draft.method === 'physical'
                        ? 'Inspector notes'
                        : 'Review notes for tenant submission'
                    }
                    placeholderTextColor={colors.muted}
                    multiline
                    style={[styles.input, styles.notes]}
                  />
                </View>
                <Pressable onPress={skipArea} style={styles.skip}>
                  <Text style={styles.skipText}>Skip this area instead</Text>
                </Pressable>
              </>
            )}
          </ScrollView>
          {names.length > 0 ? (
            <InspectionAreaActionBar
              checked={current.available === true && (current.areaPhotos?.length ?? 0) > 0 ? 1 : 0}
              total={current.available === false ? 0 : 1}
              issues={0}
              busy={busy != null}
              busyLabel={busy === 'photo' ? 'Uploading photos...' : undefined}
              isLast={areaIndex >= names.length - 1}
              onNext={() => {
                void nextArea();
              }}
            />
          ) : null}
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!areasDragging}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.title}>{INSPECTION_PAY_LABEL[type] ?? type}</Text>
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
              {type === 'routine' && sms ? (
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
          onDraggingChange={setAreasDragging}
          onAddAllExisting={existingAreas.length > 0 ? addAllFromIngoing : undefined}
          onComplete={completeSetup}
        />
      </ScrollView>
      )}
      <JobCamera
        visible={cameraOpen}
        mode="burst"
        maxPhotos={INSPECTION_BURST_MAX}
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
      {Celebration}
    </View>
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
  errorPad: { color: colors.destructive, fontSize: 13, paddingHorizontal: 16, paddingTop: 8 },
  notesLabel: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  skip: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
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
