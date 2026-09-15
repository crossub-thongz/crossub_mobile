import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  fetchInspectionDetail,
  linkInspectionAreaPhotos,
} from '@/src/api/inspector';
import { photoAreaName } from '@/src/constants/inspection-areas';
import { AddSectionControl } from '@/src/jobs/add-section-control';
import { compressPhotoForUpload, type LocalPhoto } from '@/src/jobs/compress-photo';
import { JobCamera } from '@/src/jobs/job-camera';
import { SpecialReportingForm } from '@/src/jobs/special-reporting-form';
import { resolveAreaDefinition, type CustomAreaDefinition } from '@/src/lib/custom-inspection-areas';
import { findingsAreaFromSections } from '@/src/lib/inspection-findings-items';
import { buildSectionPickerOptions } from '@/src/lib/inspection-section-utils';
import {
  allGoodMarks,
  applyColumnMark,
  emptyItemMarks,
  firstIncompleteSection,
  ITEM_CONDITION_KEYS,
  ITEM_CONDITION_LABEL,
  marksAreComplete,
  marksHaveNo,
  type ItemConditionKey,
  type ItemConditionMarks,
} from '@/src/lib/item-condition-marks';
import { seedOutgoingReferencePhotos } from '@/src/lib/outgoing-reference-photos';
import {
  mergeSpecialReporting,
  specialReportingAsFindings,
} from '@/src/lib/special-reporting';
import type { RoutineAreaIssueDraft, RoutineExecutionDraft } from '@/src/lib/types';
import { queueInspectionFindings, queueInspectionPhoto } from '@/src/offline/sync';
import { useOffline } from '@/src/offline/offline-context';
import { colors } from '@/src/theme';

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
  const [cameraSection, setCameraSection] = useState<string | null>(null);
  const seededRef = useRef(false);
  const { refreshPending } = useOffline();
  const currentName = names[areaIndex];
  const issue = currentName
    ? ensureIssue(currentName, draft.issues[currentName], customAreas)
    : ensureIssue('', undefined, customAreas);
  const sections = issue.activeSections ?? [];
  const pickerOptions = buildSectionPickerOptions(resolveAreaDefinition(currentName ?? '', customAreas));

  useEffect(() => {
    if (type !== 'outgoing' || seededRef.current || names.length === 0) return;
    seededRef.current = true;
    void (async () => {
      try {
        const detail = await fetchInspectionDetail(inspectionId);
        const withSections: Record<string, RoutineAreaIssueDraft> = { ...draft.issues };
        for (const name of names) {
          withSections[name] = ensureIssue(name, withSections[name], customAreas);
        }
        persist({
          ...draft,
          issues: seedOutgoingReferencePhotos(
            withSections,
            names,
            detail.referenceIngoing?.areas ?? [],
          ),
        });
      } catch {
        // Walk still works without the prior ingoing photos.
      }
    })();
    // Seed reference photos once when the walk opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, type]);

  const updateIssue = (next: RoutineAreaIssueDraft) => {
    if (!currentName) return;
    persist({ ...draft, issues: { ...draft.issues, [currentName]: next } });
  };

  const uploadForSection = async (section: string, photos: LocalPhoto[]) => {
    if (!currentName) return;
    setBusy('photo');
    setError(null);
    try {
      await ensureAccepted();
      const uploaded: string[] = [];
      const side = type === 'outgoing' ? 'outgoing' : undefined;
      for (const photo of photos) {
        const body = await compressPhotoForUpload(photo);
        const saved = await queueInspectionPhoto(
          inspectionId,
          {
            ...body,
            areaName: photoAreaName(currentName, section, side),
          },
          photo.uri,
        );
        uploaded.push(saved.url);
      }
      const latest = ensureIssue(currentName, draft.issues[currentName], customAreas);
      const existing = latest.photosBySection?.[section];
      updateIssue({
        ...latest,
        available: true,
        photosBySection: {
          ...(latest.photosBySection ?? {}),
          [section]: withCurrentUrls(type, existing, [...currentUrls(type, existing), ...uploaded]),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed ? please retry');
    } finally {
      setBusy(null);
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
      if (areaIndex >= names.length - 1) goSpecial();
      else goArea(areaIndex + 1);
      return;
    }
    const photographed = sections.some(
      (section) => currentUrls(type, rec.photosBySection?.[section]).length > 0,
    );
    if (!photographed) {
      setError('Snap at least one photo in this room');
      return;
    }
    const incomplete = firstIncompleteSection(sections, rec.itemMarks);
    if (incomplete) {
      setError(`Mark Clean / Undamaged / Working for ${incomplete}`);
      return;
    }
    setError(null);
    if (areaIndex >= names.length - 1) goSpecial();
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
      persist({ ...draft, workflowStep: 'areas', specialReportingComplete: true });
      await onAfterFindings();
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

  if (draft.workflowStep === 'special') {
    return (
      <SpecialReportingForm
        value={mergeSpecialReporting(draft.specialReporting)}
        onChange={(specialReporting) => persist({ ...draft, specialReporting })}
        submitting={busy === 'complete'}
        error={error}
        onBack={() => persist({ ...draft, workflowStep: 'areas' })}
        onFinalise={() => {
          void finalize();
        }}
      />
    );
  }

  const checkedCount = sections.filter((section) =>
    marksAreComplete(issue.itemMarks?.[section]),
  ).length;
  const issueCount = sections.filter((section) => marksHaveNo(issue.itemMarks?.[section])).length;

  return (
    <>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {names.length === 0 ? (
          <Text style={styles.body}>No areas selected for this inspection.</Text>
        ) : (
          <>
            <View style={styles.pips}>
              {names.map((name, index) => {
                const rec = draft.issues[name];
                const skipped = rec?.available === false;
                const photographed = (rec?.activeSections ?? []).some(
                  (section) => currentUrls(type, rec?.photosBySection?.[section]).length > 0,
                );
                const done =
                  skipped ||
                  (photographed && !firstIncompleteSection(rec?.activeSections ?? [], rec?.itemMarks));
                return (
                  <Pressable
                    key={name}
                    onPress={() => goArea(index)}
                    style={[styles.pip, index === areaIndex && styles.pipOn, done && styles.pipDone]}
                  />
                );
              })}
            </View>
            <Text style={styles.kicker}>
              Area {areaIndex + 1} of {names.length}
            </Text>
            <Text style={styles.title}>{currentName}</Text>
            <Text style={styles.meta}>
              {checkedCount}/{sections.length} items ? {issueCount} issue
              {issueCount === 1 ? '' : 's'}
            </Text>

            {issue.available === false ? (
              <>
                <Text style={styles.banner}>
                  This area was marked unavailable. You can change that and photograph it, or continue.
                </Text>
                <Pressable
                  onPress={() => updateIssue({ ...issue, available: true })}
                  style={styles.secondary}
                >
                  <Text style={styles.secondaryText}>Mark available and photograph</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.row}>
                  <Pressable
                    onPress={() =>
                      updateIssue({ ...issue, itemMarks: markAll(sections, true) })
                    }
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>Mark all good</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      updateIssue({ ...issue, itemMarks: markAll(sections, false) })
                    }
                    style={styles.chip}
                  >
                    <Text style={styles.chipText}>Clear marks</Text>
                  </Pressable>
                </View>
                <View style={styles.row}>
                  {ITEM_CONDITION_KEYS.map((key) => (
                    <Pressable
                      key={key}
                      onPress={() =>
                        updateIssue({
                          ...issue,
                          itemMarks: applyColumnMark(issue.itemMarks, sections, key, true),
                        })
                      }
                      style={styles.chip}
                    >
                      <Text style={styles.chipText}>All {ITEM_CONDITION_LABEL[key]}</Text>
                    </Pressable>
                  ))}
                </View>

                {sections.map((section) => (
                  <SectionCard
                    key={section}
                    type={type}
                    section={section}
                    marks={issue.itemMarks?.[section] ?? emptyItemMarks()}
                    comment={issue.itemComments?.[section] ?? ''}
                    photos={issue.photosBySection?.[section]}
                    onRemove={() =>
                      updateIssue({
                        ...issue,
                        activeSections: sections.filter((item) => item !== section),
                      })
                    }
                    onMarks={(marks) =>
                      updateIssue({
                        ...issue,
                        itemMarks: { ...(issue.itemMarks ?? {}), [section]: marks },
                      })
                    }
                    onComment={(comment) =>
                      updateIssue({
                        ...issue,
                        itemComments: { ...(issue.itemComments ?? {}), [section]: comment },
                      })
                    }
                    onCamera={() => setCameraSection(section)}
                  />
                ))}

                <AddSectionControl
                  optionalSections={pickerOptions}
                  activeSections={sections}
                  onAddSection={(section) =>
                    updateIssue({ ...issue, activeSections: [...sections, section] })
                  }
                />

                <Text style={styles.label}>Area notes</Text>
                <TextInput
                  value={issue.notes}
                  onChangeText={(notes) => updateIssue({ ...issue, notes, available: true })}
                  placeholder="Notes"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={[styles.input, styles.notes]}
                />
              </>
            )}

            <Pressable onPress={() => updateIssue({ ...issue, available: false })} style={styles.secondary}>
              <Text style={styles.secondaryText}>Skip this area instead</Text>
            </Pressable>
            <Pressable
              onPress={saveAreaAndAdvance}
              disabled={busy != null}
              style={[styles.primary, busy != null && styles.disabled]}
            >
              {busy === 'complete' ? (
                <ActivityIndicator color={colors.primaryFg} />
              ) : (
                <Text style={styles.primaryText}>
                  {areaIndex >= names.length - 1 ? 'Special reporting' : 'Next area'}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
      <JobCamera
        visible={cameraSection != null}
        mode="burst"
        onClose={() => setCameraSection(null)}
        onBurstComplete={(photos) => {
          if (!cameraSection) return;
          void uploadForSection(cameraSection, photos);
        }}
      />
    </>
  );
}

function SectionCard({
  type,
  section,
  marks,
  comment,
  photos,
  onRemove,
  onMarks,
  onComment,
  onCamera,
}: {
  type: 'ingoing' | 'outgoing';
  section: string;
  marks: ItemConditionMarks;
  comment: string;
  photos?: { ingoingPhotoUrls: string[]; outgoingPhotoUrls: string[] };
  onRemove: () => void;
  onMarks: (marks: ItemConditionMarks) => void;
  onComment: (value: string) => void;
  onCamera: () => void;
}) {
  const taken = currentUrls(type, photos);
  const reference = type === 'outgoing' ? (photos?.ingoingPhotoUrls ?? []) : [];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{section}</Text>
        <Pressable onPress={onRemove}>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      </View>
      {ITEM_CONDITION_KEYS.map((key: ItemConditionKey) => (
        <View key={key} style={styles.markRow}>
          <Text style={styles.markLabel}>{ITEM_CONDITION_LABEL[key]}</Text>
          <View style={styles.toggleRow}>
            {([true, false] as const).map((value) => (
              <Pressable
                key={String(value)}
                onPress={() => onMarks({ ...marks, [key]: value })}
                style={[styles.toggle, marks[key] === value && styles.toggleOn]}
              >
                <Text style={[styles.toggleText, marks[key] === value && styles.toggleTextOn]}>
                  {value ? 'Yes' : 'No'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {reference.length > 0 ? (
        <View>
          <Text style={styles.sideLabel}>Ingoing reference</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
            {reference.map((url) => (
              <Image key={url} source={{ uri: url }} style={styles.thumb} />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
        {taken.map((url) => (
          <Image key={url} source={{ uri: url }} style={styles.thumb} />
        ))}
      </ScrollView>
      <Pressable onPress={onCamera} style={styles.secondary}>
        <Text style={styles.secondaryText}>
          {taken.length > 0 ? `${taken.length} photo${taken.length === 1 ? '' : 's'} ? add more` : 'Take photos'}
        </Text>
      </Pressable>
      <TextInput
        value={comment}
        onChangeText={onComment}
        placeholder="Comment"
        placeholderTextColor={colors.muted}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  meta: { color: colors.muted, fontSize: 12 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  chipText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  pips: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pip: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.secondary },
  pipOn: { backgroundColor: colors.primary },
  pipDone: { backgroundColor: '#34d399' },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: colors.text, fontWeight: '600', flex: 1, paddingRight: 8 },
  remove: { color: colors.destructive, fontSize: 12, fontWeight: '600' },
  markRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  markLabel: { color: colors.text, fontSize: 13 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { color: colors.text, fontWeight: '600', fontSize: 12 },
  toggleTextOn: { color: colors.primaryFg },
  photos: { gap: 8 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.secondary },
  sideLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
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
  disabled: { opacity: 0.55 },
});
