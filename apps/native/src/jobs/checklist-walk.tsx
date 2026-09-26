import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';

import { apiErrorMessage } from '@/src/api/client';
import {
  fetchInspectionDetail,
  linkInspectionAreaPhotos,
} from '@/src/api/inspector';
import { photoAreaName } from '@/src/constants/inspection-areas';
import { INSPECTION_BURST_MAX, type LocalPhoto } from '@/src/jobs/compress-photo';
import { InspectionAreaActionBar } from '@/src/jobs/inspection-area-action-bar';
import { InspectionAreaNav } from '@/src/jobs/inspection-area-nav';
import { InspectionPhotosField } from '@/src/jobs/inspection-photos-field';
import { InspectionSectionPhotos } from '@/src/jobs/inspection-section-photos';
import { JobCamera } from '@/src/jobs/job-camera';
import { SpecialReportingForm } from '@/src/jobs/special-reporting-form';
import { resolveAreaDefinition, type CustomAreaDefinition } from '@/src/lib/custom-inspection-areas';
import { findingsAreaFromSections } from '@/src/lib/inspection-findings-items';
import { moveIndex, rekeyRecord } from '@/src/lib/inspection-layout-edit';
import {
  allGoodMarks,
  emptyItemMarks,
  firstIncompleteSection,
  marksAreComplete,
  marksHaveNo,
  type ItemConditionMarks,
} from '@/src/lib/item-condition-marks';
import { seedOutgoingReferencePhotos } from '@/src/lib/outgoing-reference-photos';
import {
  mergeSpecialReporting,
  specialReportingAsFindings,
} from '@/src/lib/special-reporting';
import { useInspections } from '@/src/inspections/inspections-context';
import type { RoutineAreaIssueDraft, RoutineExecutionDraft } from '@/src/lib/types';
import { queueInspectionFindings, queueInspectionPhotoBatch } from '@/src/offline/sync';
import { upsertPhotoUrl } from '@/src/offline/queued-photo';
import { useOffline } from '@/src/offline/offline-context';
import { colors } from '@/src/theme';

const RESPONSIBILITY = ['Tenant Responsible', 'Landlord Responsible', 'Fair Wear & Tear'] as const;

type CameraTarget =
  | { kind: 'area' }
  | { kind: 'section'; section: string; side?: 'ingoing' | 'outgoing' };

function emptySectionPhotos() {
  return { ingoingPhotoUrls: [] as string[], outgoingPhotoUrls: [] as string[] };
}

function ensureIssue(
  name: string,
  current: RoutineAreaIssueDraft | undefined,
  customAreas: CustomAreaDefinition[] = [],
): RoutineAreaIssueDraft {
  const base = current ?? { available: true as const, notes: '', areaPhotos: [] as string[] };
  const definition = resolveAreaDefinition(name, customAreas);
  const sections =
    base.activeSections && base.activeSections.length > 0
      ? base.activeSections
      : [...definition.defaultSections];
  return {
    ...base,
    available: base.available ?? true,
    activeSections: sections,
    itemMarks: base.itemMarks ?? {},
    itemComments: base.itemComments ?? {},
    photosBySection: base.photosBySection ?? {},
  };
}

function currentUrls(
  type: 'ingoing' | 'outgoing',
  photos: { ingoingPhotoUrls: string[]; outgoingPhotoUrls: string[] } | undefined,
): string[] {
  if (!photos) return [];
  return type === 'outgoing' ? photos.outgoingPhotoUrls : photos.ingoingPhotoUrls;
}

function withCurrentUrls(
  type: 'ingoing' | 'outgoing',
  photos: { ingoingPhotoUrls: string[]; outgoingPhotoUrls: string[] } | undefined,
  urls: string[],
) {
  const base = photos ?? emptySectionPhotos();
  if (type === 'outgoing') return { ...base, outgoingPhotoUrls: urls };
  return { ...base, ingoingPhotoUrls: urls };
}

function markAll(sections: readonly string[], good: boolean): Record<string, ItemConditionMarks> {
  const next: Record<string, ItemConditionMarks> = {};
  for (const section of sections) {
    next[section] = good ? allGoodMarks() : emptyItemMarks();
  }
  return next;
}

function omitKey<T>(record: Record<string, T> | undefined, key: string): Record<string, T> {
  const next = { ...(record ?? {}) };
  delete next[key];
  return next;
}

export function ChecklistWalk({
  inspectionId,
  type,
  draft,
  persist,
  names,
  areaIndex,
  goArea,
  ensureAccepted,
  busy,
  setBusy,
  error,
  setError,
  onAfterFindings,
  customAreas = [],
}: {
  inspectionId: string;
  type: 'ingoing' | 'outgoing';
  draft: RoutineExecutionDraft;
  persist: (next: RoutineExecutionDraft) => void;
  names: string[];
  areaIndex: number;
  goArea: (index: number) => void;
  ensureAccepted: () => Promise<void>;
  busy: string | null;
  setBusy: (value: string | null) => void;
  error: string | null;
  setError: (value: string | null) => void;
  onAfterFindings: () => Promise<void>;
  customAreas?: CustomAreaDefinition[];
}) {
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const cameraTargetRef = useRef<CameraTarget | null>(null);
  const listScrollRef = useRef<ScrollView>(null);
  const listWrapRef = useRef<View>(null);
  const listScrollY = useRef(0);
  const listWindowY = useRef(0);
  const [itemsDragging, setItemsDragging] = useState(false);
  const [ingoingFromReference, setIngoingFromReference] = useState(false);
  const seededRef = useRef(false);
  const { refreshPending } = useOffline();
  const { draftsHydrated } = useInspections();
  const currentName = names[areaIndex];
  const issue = currentName
    ? ensureIssue(currentName, draft.issues[currentName], customAreas)
    : ensureIssue('', undefined, customAreas);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const sections = issue.activeSections ?? [];
  const isLast = names.length > 0 && areaIndex >= names.length - 1;

  const keepOpenedItemInView = useCallback((itemWindowY: number) => {
    const delta = itemWindowY - listWindowY.current - 8;
    if (Math.abs(delta) < 12) return;
    listScrollRef.current?.scrollTo({
      y: Math.max(0, listScrollY.current + delta),
      animated: true,
    });
  }, []);

  useEffect(() => {
    if (!draftsHydrated || type !== 'outgoing' || seededRef.current || names.length === 0) return;
    seededRef.current = true;
    void (async () => {
      try {
        const detail = await fetchInspectionDetail(inspectionId);
        const latest = draftRef.current;
        const withSections: Record<string, RoutineAreaIssueDraft> = { ...latest.issues };
        for (const name of names) {
          withSections[name] = ensureIssue(name, withSections[name], customAreas);
        }
        const nextIssues = seedOutgoingReferencePhotos(
          withSections,
          names,
          detail.referenceIngoing?.areas ?? [],
        );
        setIngoingFromReference(
          names.some((name) =>
            Object.values(nextIssues[name]?.photosBySection ?? {}).some(
              (photos) => photos.ingoingPhotoUrls.length > 0,
            ),
          ),
        );
        persist({
          ...latest,
          issues: nextIssues,
        });
      } catch {
        // Walk still works without the prior ingoing photos.
      }
    })();
    // Seed reference photos once when the walk opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, type, draftsHydrated]);

  const updateIssue = (next: RoutineAreaIssueDraft) => {
    if (!currentName) return;
    patchIssue(currentName, () => next);
  };

  const patchIssue = (
    areaName: string,
    updater: (current: RoutineAreaIssueDraft) => RoutineAreaIssueDraft,
  ) => {
    if (!areaName) return;
    const rec = ensureIssue(areaName, draftRef.current.issues[areaName], customAreas);
    const merged = {
      ...draftRef.current,
      issues: { ...draftRef.current.issues, [areaName]: updater(rec) },
    };
    draftRef.current = merged;
    persist(merged);
  };

  const attachAreaPhotos = async (photos: LocalPhoto[]) => {
    const areaName = currentName;
    if (!areaName || photos.length === 0) return;
    setError(null);
    try {
      await ensureAccepted();
      await queueInspectionPhotoBatch(inspectionId, photos, areaName, (fromUri, toUri) => {
        patchIssue(areaName, (rec) => ({
          ...rec,
          available: true,
          areaPhotos: upsertPhotoUrl(rec.areaPhotos ?? [], fromUri, toUri),
        }));
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'Photo upload failed - please retry'));
    }
  };

  const attachSectionPhotos = async (
    section: string,
    photos: LocalPhoto[],
    side?: 'ingoing' | 'outgoing',
  ) => {
    const areaName = currentName;
    if (!areaName || photos.length === 0) return;
    if (type === 'outgoing' && side === 'ingoing') return;
    const resolvedSide = side ?? (type === 'outgoing' ? 'outgoing' : undefined);
    const slot: 'ingoing' | 'outgoing' =
      resolvedSide === 'outgoing' || type === 'outgoing' ? 'outgoing' : 'ingoing';

    setError(null);
    try {
      await ensureAccepted();
      await queueInspectionPhotoBatch(
        inspectionId,
        photos,
        photoAreaName(areaName, section, resolvedSide),
        (fromUri, toUri) => {
          patchIssue(areaName, (rec) => {
            const photosForSection = rec.photosBySection?.[section];
            if (resolvedSide === 'ingoing') {
              return {
                ...rec,
                available: true,
                photosBySection: {
                  ...(rec.photosBySection ?? {}),
                  [section]: {
                    ...(photosForSection ?? emptySectionPhotos()),
                    ingoingPhotoUrls: upsertPhotoUrl(
                      photosForSection?.ingoingPhotoUrls ?? [],
                      fromUri,
                      toUri,
                    ),
                  },
                },
              };
            }
            return {
              ...rec,
              available: true,
              photosBySection: {
                ...(rec.photosBySection ?? {}),
                [section]: withCurrentUrls(
                  slot,
                  photosForSection,
                  upsertPhotoUrl(currentUrls(slot, photosForSection), fromUri, toUri),
                ),
              },
            };
          });
        },
      );
    } catch (err) {
      setError(apiErrorMessage(err, 'Photo upload failed - please retry'));
    }
  };

  const goSpecial = () => {
    persist({
      ...draft,
      workflowStep: 'special',
      specialReporting: mergeSpecialReporting(draft.specialReporting),
      specialReportingComplete: false,
    });
  };

  const saveAreaAndAdvance = () => {
    if (!currentName) return;
    const rec = ensureIssue(currentName, draft.issues[currentName], customAreas);
    if (rec.available === false) {
      if (isLast) goSpecial();
      else goArea(areaIndex + 1);
      return;
    }
    if (sections.length === 0) {
      setError('Add at least one item, or skip this area');
      return;
    }
    const incomplete = firstIncompleteSection(sections, rec.itemMarks);
    if (incomplete) {
      setError(`Finish marking or unmark "${incomplete}"`);
      return;
    }
    const photographed =
      (rec.areaPhotos?.length ?? 0) > 0 ||
      sections.some((section) => currentUrls(type, rec.photosBySection?.[section]).length > 0);
    if (!photographed) {
      setError('Snap at least one photo for this area');
      return;
    }
    setError(null);
    if (isLast) goSpecial();
    else goArea(areaIndex + 1);
  };

  const finalize = async () => {
    setBusy('complete');
    setError(null);
    try {
      await ensureAccepted();
      const reporting = mergeSpecialReporting(draft.specialReporting);
      const areas = names.map((name) => {
        const rec = ensureIssue(name, draft.issues[name], customAreas);
        if (rec.available !== true) {
          return {
            name,
            items: (rec.activeSections ?? []).map((section) => ({ name: section })),
          };
        }
        return findingsAreaFromSections({
          name,
          sections: rec.activeSections ?? [],
          marksBySection: rec.itemMarks,
          commentsBySection: rec.itemComments,
          notes: rec.notes,
        });
      });
      areas.push(specialReportingAsFindings(reporting));

      if (type === 'outgoing') {
        for (const name of names) {
          const rec = ensureIssue(name, draft.issues[name], customAreas);
          if (rec.available !== true) continue;
          for (const section of rec.activeSections ?? []) {
            const urls = rec.photosBySection?.[section]?.ingoingPhotoUrls ?? [];
            if (urls.length === 0) continue;
            try {
              await linkInspectionAreaPhotos(inspectionId, {
                areaName: photoAreaName(name, section, 'ingoing'),
                urls,
              });
            } catch {
              // Findings can still complete if link-area is unreachable.
            }
          }
        }
      }

      const findingsState = await queueInspectionFindings(inspectionId, { areas });
      void refreshPending();
      if (findingsState === 'queued') {
        setError(
          'Saved on this phone. When you are back online, open Settings and tap Sync now, then finalise again.',
        );
        return;
      }
      persist({
        ...draft,
        workflowStep: 'areas',
        specialReportingComplete: true,
        inspectionFinished: true,
      });
      await onAfterFindings();
    } catch (err) {
      setError(
        apiErrorMessage(
          err,
          'The findings could not be saved. Check your connection and complete the report again.',
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  if (draft.workflowStep === 'special') {
    return (
      <SpecialReportingForm
        value={mergeSpecialReporting(draft.specialReporting)}
        onChange={(specialReporting) => persist({ ...draft, specialReporting })}
        submitting={busy === 'complete'}
        error={error}
        phase={type}
        onBack={() =>
          persist({
            ...draft,
            workflowStep: 'areas',
            areaIndex: names.length > 0 ? names.length - 1 : 0,
          })
        }
        onFinalise={() => {
          void finalize();
        }}
      />
    );
  }

  const checkedCount = sections.filter((section) => marksAreComplete(issue.itemMarks?.[section])).length;
  const issueCount = sections.filter((section) => marksHaveNo(issue.itemMarks?.[section])).length;
  const formBusy = busy === 'complete';

  const areaComplete = (index: number, name: string) => {
    const rec = draft.issues[name];
    const skipped = rec?.available === false;
    const photographed =
      (rec?.areaPhotos?.length ?? 0) > 0 ||
      (rec?.activeSections ?? []).some(
        (section) => currentUrls(type, rec?.photosBySection?.[section]).length > 0,
      );
    return (
      skipped ||
      (rec?.available === true &&
        (rec.activeSections?.length ?? 0) > 0 &&
        !firstIncompleteSection(rec.activeSections ?? [], rec.itemMarks) &&
        photographed)
    );
  };

  return (
    <View style={styles.screen}>
      {names.length > 0 ? (
        <InspectionAreaNav names={names} areaIndex={areaIndex} isComplete={areaComplete} onGoToArea={goArea} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View
        ref={listWrapRef}
        style={styles.flex}
        onLayout={() => {
          listWrapRef.current?.measureInWindow((_x: number, y: number) => {
            listWindowY.current = y;
          });
        }}
      >
      <ScrollView
        ref={listScrollRef}
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={false}
        style={styles.flex}
        scrollEnabled={!itemsDragging}
        scrollEventThrottle={16}
        onScroll={(event) => {
          listScrollY.current = event.nativeEvent.contentOffset.y;
        }}
      >
        {names.length === 0 ? (
          <Text style={styles.body}>No areas selected for this inspection.</Text>
        ) : issue.available === false ? (
          <>
            <Text style={styles.body}>
              This area was marked unavailable. You can change that and photograph it, or continue.
            </Text>
            <Pressable onPress={() => updateIssue({ ...issue, available: true })} style={styles.secondary}>
              <Text style={styles.secondaryText}>Mark available and photograph</Text>
            </Pressable>
          </>
        ) : (
          <>
            <InspectionPhotosField
              label="Area photos"
              photoUrls={issue.areaPhotos ?? []}
              disabled={formBusy}
              emptyLabel="Snap or upload several photos of this room, then attach them here."
              onTakePhotos={() => {
                cameraTargetRef.current = { kind: 'area' };
                setCameraTarget({ kind: 'area' });
              }}
              onAddPhotos={(photos) => {
                void attachAreaPhotos(photos);
              }}
              onRemove={(index) =>
                updateIssue({
                  ...issue,
                  areaPhotos: (issue.areaPhotos ?? []).filter((_, i) => i !== index),
                })
              }
            />

            <InspectionSectionPhotos
              definition={resolveAreaDefinition(currentName ?? '', customAreas)}
              activeSections={sections}
              photosBySection={issue.photosBySection ?? {}}
              itemMarks={issue.itemMarks}
              itemComments={issue.itemComments}
              busy={formBusy}
              photoSide={type === 'outgoing' ? 'outgoing' : 'ingoing'}
              onDraggingChange={setItemsDragging}
              onOpenedItemVisible={keepOpenedItemInView}
              onAddSection={(section) => {
                if (sections.some((item) => item.toLowerCase() === section.toLowerCase())) return;
                updateIssue({ ...issue, activeSections: [...sections, section] });
              }}
              onRemoveSection={(section) =>
                updateIssue({
                  ...issue,
                  activeSections: sections.filter((item) => item !== section),
                  photosBySection: omitKey(issue.photosBySection, section),
                  itemMarks: omitKey(issue.itemMarks, section),
                  itemComments: omitKey(issue.itemComments, section),
                })
              }
              onRenameSection={(from, to) => {
                if (from === to) return;
                updateIssue({
                  ...issue,
                  activeSections: sections.map((name) => (name === from ? to : name)),
                  photosBySection: rekeyRecord(issue.photosBySection ?? {}, from, to),
                  itemMarks: rekeyRecord(issue.itemMarks ?? {}, from, to),
                  itemComments: rekeyRecord(issue.itemComments ?? {}, from, to),
                });
              }}
              onMoveSection={(from, to) =>
                updateIssue({ ...issue, activeSections: moveIndex(sections, from, to) })
              }
              onChangeMarks={(section, marks) =>
                updateIssue({
                  ...issue,
                  itemMarks: { ...(issue.itemMarks ?? {}), [section]: marks },
                })
              }
              onMarkAllGood={() => updateIssue({ ...issue, itemMarks: markAll(sections, true) })}
              onUnmarkAll={() => updateIssue({ ...issue, itemMarks: markAll(sections, false) })}
              onChangeComment={(section, comment) =>
                updateIssue({
                  ...issue,
                  itemComments: { ...(issue.itemComments ?? {}), [section]: comment },
                })
              }
              onTakePhotos={(section, side) => {
                if (type === 'outgoing' && side === 'ingoing') return;
                const target = { kind: 'section' as const, section, side };
                cameraTargetRef.current = target;
                setCameraTarget(target);
              }}
              onAddPhotos={(section, photos, side) => {
                if (type === 'outgoing' && side === 'ingoing') return;
                void attachSectionPhotos(section, photos, side);
              }}
              onRemovePhoto={(section, index, side) => {
                if (type === 'outgoing' && side === 'ingoing') return;
                const existing = issue.photosBySection?.[section] ?? emptySectionPhotos();
                const resolved = side ?? (type === 'outgoing' ? 'outgoing' : 'ingoing');
                updateIssue({
                  ...issue,
                  photosBySection: {
                    ...(issue.photosBySection ?? {}),
                    [section]:
                      resolved === 'outgoing'
                        ? {
                            ...existing,
                            outgoingPhotoUrls: existing.outgoingPhotoUrls.filter((_, i) => i !== index),
                          }
                        : {
                            ...existing,
                            ingoingPhotoUrls: existing.ingoingPhotoUrls.filter((_, i) => i !== index),
                          },
                  },
                });
              }}
            />

            <View>
              <Text style={styles.label}>{type === 'outgoing' ? 'Issue notes' : 'Comments'}</Text>
              <AppTextInput
                value={issue.notes}
                onChangeText={(notes) => updateIssue({ ...issue, notes, available: true })}
                placeholder={
                  type === 'outgoing'
                    ? 'Damage, cleaning, missing items...'
                    : 'Room condition notes'
                }
                placeholderTextColor={colors.muted}
                multiline
                style={[styles.input, styles.notes]}
              />
            </View>

            {type === 'outgoing' ? (
              <View>
                <Text style={styles.label}>Responsibility</Text>
                <View style={styles.row}>
                  {RESPONSIBILITY.map((item) => (
                    <Pressable
                      key={item}
                      onPress={() => updateIssue({ ...issue, responsibility: item })}
                      style={[styles.chip, issue.responsibility === item && styles.chipOn]}
                    >
                      <Text style={[styles.chipText, issue.responsibility === item && styles.chipTextOn]}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable onPress={() => updateIssue({ ...issue, available: false })} style={styles.skip}>
              <Text style={styles.skipText}>Skip this area instead</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      </View>
      {names.length > 0 ? (
        <InspectionAreaActionBar
          checked={issue.available === false ? 0 : checkedCount}
          total={issue.available === false ? 0 : sections.length}
          issues={issue.available === false ? 0 : issueCount}
          busy={formBusy}
          isLast={isLast}
          onNext={saveAreaAndAdvance}
        />
      ) : null}
      <JobCamera
        visible={cameraTarget != null}
        mode="burst"
        maxPhotos={INSPECTION_BURST_MAX}
        onClose={() => {
          cameraTargetRef.current = null;
          setCameraTarget(null);
        }}
        onBurstComplete={(photos) => {
          const target = cameraTargetRef.current;
          cameraTargetRef.current = null;
          setCameraTarget(null);
          if (!target || photos.length === 0) return;
          if (target.kind === 'area') {
            void attachAreaPhotos(photos);
            return;
          }
          void attachSectionPhotos(target.section, photos, target.side);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  inner: { padding: 16, paddingBottom: 32, gap: 16 },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.destructive, fontSize: 13, paddingHorizontal: 16, paddingTop: 8 },
  hint: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  label: { color: colors.text, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  chipTextOn: { color: colors.primaryFg },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 8,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  notes: { minHeight: 80, textAlignVertical: 'top' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
  skip: { alignItems: 'center', paddingVertical: 8 },
  skipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
});
