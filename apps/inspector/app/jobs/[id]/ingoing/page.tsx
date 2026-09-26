'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { toast } from 'sonner';

import { InspectionAreaActionBar } from '@/components/inspector/inspection-area-action-bar';
import { InspectionAreaPhotosField } from '@/components/inspector/inspection-area-photos-field';
import { InspectionAreaNav, inspectionAreaProgressBarClass } from '@/components/inspector/inspection-area-nav';
import { InspectionAreaSetupPanel } from '@/components/inspector/inspection-area-setup-panel';
import { InspectionInspectChrome } from '@/components/inspector/inspection-inspect-chrome';
import {
  InspectionSectionPhotos,
  markAllItemsEmpty,
  markAllItemsGood,
} from '@/components/inspector/inspection-section-photos';
import { InspectionWorkspaceHeader } from '@/components/inspector/inspection-workspace-header';
import { SpecialReportingForm } from '@/components/inspector/special-reporting-form';
import { InspectorShell } from '@/components/layout/inspector-shell';
import { JobLookupFallback } from '@/components/inspector/job-lookup-fallback';
import { KeyCollectionRequired } from '@/components/inspector/key-collection-required';
import { JobWorkflowToolbar } from '@/components/inspector/job-workflow-toolbar';
import { JobWorkspaceShell } from '@/components/inspector/job-workspace-shell';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  sectionAreaName,
} from '@/constants/inspection-areas';
import { jobDetail, jobInspect, ROUTES } from '@/constants/routes';
import { useFinishInspection } from '@/hooks/use-finish-inspection';
import { useInspectionExecutionDraft } from '@/hooks/use-inspection-execution-draft';
import type { InspectorFindingAreaPayload } from '@/lib/crossub-api/inspector-client';
import { fetchInspectionDetail } from '@/lib/crossub-api/inspector-client';
import {
  applyIngoingDetailPhotos,
  emptyIngoingEntry,
  mergeIngoingExecutionDraft,
} from '@/lib/inspection-execution-hydration';
import type { IngoingAreaEntryDraft, IngoingExecutionDraft } from '@/lib/inspection-execution-draft';
import {
  appendSelectedAreaName,
  buildExecutionAreaCatalog,
  classifyAddedAreaName,
  effectiveSelectedAreaNames,
  omitNamedRecordKey,
  removeSelectedAreaName,
  type CustomAreaSectionMode,
} from '@/lib/custom-inspection-areas';
import { inspectionAreaOverallPhotoLabel, inspectionPhotoAreaLabel } from '@/lib/inspection-area-photos';
import { jobLookupMiss } from '@/lib/job-lookup';
import { parseJobWorkspaceView } from '@/lib/job-workspace-view';
import {
  isAreaSetupComplete,
  sectionsForAvailableArea,
  seedAreasForInspectionStart,
} from '@/lib/inspection-area-workflow';
import { findingsAreaFromSections } from '@/lib/inspection-findings-items';
import {
  applyColumnMark,
  firstIncompleteSection,
  marksAreComplete,
  marksHaveNo,
  type ItemConditionKey,
  type ItemConditionMarks,
} from '@/lib/item-condition-marks';
import { moveIndex, rekeyRecord, renameCustomArea } from '@/lib/inspection-layout-edit';
import {
  draftNeedsLayoutSeed,
  layoutTemplateFromProperty,
  mergeCustomAreas,
} from '@/lib/inspection-layout-template';
import { scrollInspectionWorkspaceToTop } from '@/lib/utils';
import {
  useAwaitingAgentPaymentGate,
  useInspectionFinishedGate,
  useInspectionInProgress,
  useKeyCollectGate,
} from '@/hooks/use-key-collect-gate';
import {
  mergeSpecialReporting,
  specialReportingAsFindings,
} from '@/lib/special-reporting';

type AreaEntry = IngoingAreaEntryDraft;

function emptyEntry(areaName: string, customAreas: IngoingExecutionDraft['customAreas']): AreaEntry {
  return emptyIngoingEntry(areaName, customAreas ?? []);
}

export default function IngoingInspectionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    getJob,
    commitInspectionAreaPhotos,
    uploadInspectionPhotos,
    saveInspectionFindings,
    updateJobStatus,
    apiConnected,
    jobsHydrated,
  } = useInspectorData();
  const job = getJob(id);
  const { finish: submitInspection, Celebration } = useFinishInspection(id);
  const paymentCleared = useAwaitingAgentPaymentGate(job, id);
  const keysCollected = useKeyCollectGate(job, id);
  useInspectionFinishedGate(job, id);
  useInspectionInProgress(job, id, updateJobStatus);
  const { draft, setDraft, clearDraft, localDraftLoaded } = useInspectionExecutionDraft(
    id,
    job,
    'ingoing',
    (): IngoingExecutionDraft => ({
      kind: 'ingoing',
      areaIndex: 0,
      entries: {},
      customAreas: [],
      areaSetupComplete: false,
    }),
    keysCollected,
  );
  const photoInflight = useRef(0);
  const [formBusy, setFormBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const busy = formBusy || photoBusy;

  const beginPhotoUpload = () => {
    photoInflight.current += 1;
    setPhotoBusy(true);
  };

  const endPhotoUpload = () => {
    photoInflight.current = Math.max(0, photoInflight.current - 1);
    if (photoInflight.current === 0) setPhotoBusy(false);
  };
  const serverHydrated = useRef(false);

  useEffect(() => {
    if (!apiConnected) serverHydrated.current = false;
  }, [apiConnected]);

  useEffect(() => {
    if (!apiConnected || !id || !localDraftLoaded.current || serverHydrated.current) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const detail = await fetchInspectionDetail(id);
        if (cancelled) return;
        setDraft((prev) =>
          mergeIngoingExecutionDraft(
            {
              kind: 'ingoing',
              areaIndex: prev.areaIndex,
              entries: applyIngoingDetailPhotos(
                prev.entries,
                detail,
                prev.customAreas ?? [],
              ),
              customAreas: prev.customAreas ?? [],
            },
            prev,
          ),
        );
      } catch {
        // Offline or demo — local draft still applies.
      } finally {
        if (!cancelled) serverHydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiConnected, id, setDraft, localDraftLoaded]);

  useEffect(() => {
    if (!job || !localDraftLoaded.current) return;
    setDraft((prev) => {
      const layout = layoutTemplateFromProperty(job.property);
      if (!draftNeedsLayoutSeed(prev, layout.names)) return prev;
      const nextCustom = mergeCustomAreas(prev.customAreas ?? [], layout.customAreas);
      const nextEntries: typeof prev.entries = {};
      for (const name of layout.names) {
        nextEntries[name] = prev.entries[name] ?? emptyEntry(name, nextCustom);
      }
      return {
        ...prev,
        selectedAreaNames: layout.names,
        customAreas: nextCustom,
        entries: nextEntries,
      };
    });
  }, [job, setDraft]);

  const customAreas = draft.customAreas ?? [];
  const areaSetupComplete = isAreaSetupComplete(draft);
  const selectedAreaNames = effectiveSelectedAreaNames(
    draft.selectedAreaNames,
    draft.entries,
    customAreas,
  );
  const workspaceView = parseJobWorkspaceView(
    searchParams.get('view'),
    areaSetupComplete,
  );
  const inspectRequested = searchParams.get('view') === 'inspect';
  const canInspect =
    areaSetupComplete || (inspectRequested && selectedAreaNames.length > 0);
  const areaCatalog = useMemo(
    () =>
      canInspect ? buildExecutionAreaCatalog(selectedAreaNames, customAreas) : [],
    [canInspect, selectedAreaNames, customAreas],
  );
  const areaIndex = Math.min(
    Math.max(draft.areaIndex, 0),
    Math.max(areaCatalog.length - 1, 0),
  );
  const entries = draft.entries;

  useEffect(() => {
    if (!isAreaSetupComplete(draft)) return;
    setDraft((prev) => {
      const custom = prev.customAreas ?? [];
      const selected = effectiveSelectedAreaNames(
        prev.selectedAreaNames,
        prev.entries,
        custom,
      );
      if (selected.length === 0) return prev;
      const { record, changed } = seedAreasForInspectionStart(prev.entries, selected, {
        sectionsFor: (name) => sectionsForAvailableArea(name, custom, null, 'ingoing'),
        emptyEntry: (name) => emptyEntry(name, custom),
        emptyPhotos: () => [],
      });
      if (!changed) return prev;
      return { ...prev, selectedAreaNames: selected, entries: record };
    });
  }, [draft.areaSetupComplete, setDraft]);

  useEffect(() => {
    if (searchParams.get('view') !== 'inspect') return;
    setDraft((prev) => {
      if (prev.areaSetupComplete) return prev;
      const custom = prev.customAreas ?? [];
      const selected = effectiveSelectedAreaNames(
        prev.selectedAreaNames,
        prev.entries,
        custom,
      );
      if (selected.length === 0) return prev;
      const { record } = seedAreasForInspectionStart(prev.entries, selected, {
        sectionsFor: (name) => sectionsForAvailableArea(name, custom, null, 'ingoing'),
        emptyEntry: (name) => emptyEntry(name, custom),
        emptyPhotos: () => [],
      });
      return {
        ...prev,
        selectedAreaNames: selected,
        areaSetupComplete: true,
        entries: record,
      };
    });
  }, [searchParams, setDraft]);

  const handleAddCustomArea = (name: string, sectionMode: CustomAreaSectionMode) => {
    const classified = classifyAddedAreaName(name);
    setDraft((prev) => {
      const setupComplete = prev.areaSetupComplete === true;
      let nextCustom = prev.customAreas ?? [];
      if (classified.kind === 'custom') {
        const exists = nextCustom.some(
          (area) => area.name.trim().toLowerCase() === classified.name.toLowerCase(),
        );
        if (!exists) {
          nextCustom = [...nextCustom, { name: classified.name, sectionMode }];
        }
      }
      const nextSelected = appendSelectedAreaName(
        prev.selectedAreaNames,
        classified.name,
        prev.entries,
        nextCustom,
      );
      let nextEntries = {
        ...prev.entries,
        [classified.name]:
          prev.entries[classified.name] ?? emptyEntry(classified.name, nextCustom),
      };
      if (setupComplete) {
        nextEntries = seedAreasForInspectionStart(nextEntries, [classified.name], {
          sectionsFor: (areaName) =>
            sectionsForAvailableArea(areaName, nextCustom, null, 'ingoing'),
          emptyEntry: (areaName) => emptyEntry(areaName, nextCustom),
          emptyPhotos: () => [],
        }).record;
      }
      return {
        ...prev,
        customAreas: nextCustom,
        selectedAreaNames: nextSelected,
        areaIndex: setupComplete
          ? Math.max(0, nextSelected.findIndex((item) => item === classified.name))
          : prev.areaIndex,
        entries: nextEntries,
      };
    });
    toast.success(`Added “${classified.name}”`);
  };

  const handleAddBuiltInArea = (name: string) => {
    handleAddCustomArea(name, 'standard');
  };

  const handleRemoveSetupArea = (name: string) => {
    setDraft((prev) => {
      const nextSelected = removeSelectedAreaName(
        prev.selectedAreaNames,
        name,
        prev.entries,
        prev.customAreas ?? [],
      );
      const nextCustom = (prev.customAreas ?? []).filter(
        (item) => item.name.trim().toLowerCase() !== name.trim().toLowerCase(),
      );
      return {
        ...prev,
        selectedAreaNames: nextSelected,
        customAreas: nextCustom,
        entries: omitNamedRecordKey(prev.entries, name),
        areaIndex: Math.min(prev.areaIndex, Math.max(nextSelected.length - 1, 0)),
      };
    });
  };

  const handleMoveSetupArea = (from: number, to: number) => {
    setDraft((prev) => ({
      ...prev,
      selectedAreaNames: moveIndex(
        effectiveSelectedAreaNames(
          prev.selectedAreaNames,
          prev.entries,
          prev.customAreas ?? [],
        ),
        from,
        to,
      ),
    }));
  };

  const handleRenameSetupArea = (from: string, to: string) => {
    if (from === to) return;
    setDraft((prev) => {
      const nextSelected = (prev.selectedAreaNames ?? []).map((name) =>
        name === from ? to : name,
      );
      return {
        ...prev,
        selectedAreaNames: nextSelected,
        customAreas: renameCustomArea(prev.customAreas ?? [], from, to),
        entries: rekeyRecord(prev.entries, from, to),
      };
    });
  };

  const completeAreaSetup = () => {
    setDraft((prev) => {
      const custom = prev.customAreas ?? [];
      const selected = effectiveSelectedAreaNames(
        prev.selectedAreaNames,
        prev.entries,
        custom,
      );
      const { record } = seedAreasForInspectionStart(prev.entries, selected, {
        sectionsFor: (name) => sectionsForAvailableArea(name, custom, null, 'ingoing'),
        emptyEntry: (name) => emptyEntry(name, custom),
        emptyPhotos: () => [],
      });
      return {
        ...prev,
        selectedAreaNames: selected,
        areaSetupComplete: true,
        areaIndex: prev.areaSetupComplete ? prev.areaIndex : 0,
        entries: record,
      };
    });
  };

  if (!job) {
    return (
      <JobLookupFallback
        state={jobLookupMiss(jobsHydrated)}
        backHref={ROUTES.INSPECTIONS}
      />
    );
  }

  // Payment gate redirects to job detail; don't render workflow while unpaid.
  if (!paymentCleared) {
    return (
      <InspectorShell title="Entry Inspection" backHref={jobDetail(id)}>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-700 dark:text-amber-300">
          Waiting for the agency to pay the platform fee before you can start
          this job.
        </p>
      </InspectorShell>
    );
  }

  // The redirect useKeyCollectGate asks for is asynchronous and can fail; rendering
  // the workflow in the meantime is how a whole field pass gets typed into a screen
  // whose writes the API rejects.
  if (!keysCollected) {
    return <KeyCollectionRequired jobId={id} />;
  }

  if (workspaceView === 'areas' || !canInspect) {
    return (
      <JobWorkspaceShell job={job} active="areas">
        <InspectionAreaSetupPanel
          job={job}
          kind="ingoing"
          selectedAreaNames={selectedAreaNames}
          customAreas={customAreas}
          continuing={areaSetupComplete || selectedAreaNames.length > 0 || areaIndex > 0}
          layoutSource={selectedAreaNames.length > 0 ? 'template' : 'manual'}
          busy={busy}
          onAddBuiltInArea={handleAddBuiltInArea}
          onAddCustomArea={handleAddCustomArea}
          onRemoveArea={handleRemoveSetupArea}
          onRenameArea={handleRenameSetupArea}
          onMoveArea={handleMoveSetupArea}
          onComplete={() => {
            completeAreaSetup();
            router.replace(jobInspect(id, job.type));
          }}
        />
      </JobWorkspaceShell>
    );
  }

  if (areaCatalog.length === 0) {
    return (
      <InspectorShell title="Entry Inspection" backHref={jobDetail(id)}>
        <p className="text-muted-foreground text-sm">No areas selected for this inspection.</p>
      </InspectorShell>
    );
  }

  const areaDef = areaCatalog[areaIndex];
  const area = areaDef?.name ?? areaCatalog[0]?.name ?? 'Area';
  const rawEntry = entries[area] ?? emptyEntry(area, customAreas);
  const entry =
    rawEntry.available != null
      ? rawEntry
      : (seedAreasForInspectionStart({ [area]: rawEntry }, [area], {
          sectionsFor: (name) =>
            sectionsForAvailableArea(name, customAreas, null, 'ingoing'),
          emptyEntry: (name) => emptyEntry(name, customAreas),
          emptyPhotos: () => [],
        }).record[area] ?? rawEntry);
  const isLast = areaIndex === areaCatalog.length - 1;

  const updateEntry = (patch: Partial<AreaEntry>) => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      return {
        ...prev,
        entries: { ...prev.entries, [area]: { ...current, ...patch } },
      };
    });
  };

  const goToArea = (index: number) => {
    if (index < 0 || index >= areaCatalog.length) return;
    setDraft((prev) => ({ ...prev, areaIndex: index }));
    scrollInspectionWorkspaceToTop();
  };

  const markAvailable = (available: boolean) => {
    if (!available) {
      setDraft((prev) => ({
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...emptyEntry(area, prev.customAreas),
            available: false,
            activeSections: [],
            photosBySection: {},
          },
        },
        areaIndex: !isLast ? prev.areaIndex + 1 : prev.areaIndex,
      }));
      return;
    }
    const sections = sectionsForAvailableArea(
      area,
      customAreas,
      null,
      'ingoing',
    );
    const photosBySection: Record<string, string[]> = {
      ...(entry.photosBySection ?? {}),
    };
    for (const section of sections) {
      if (!photosBySection[section]) photosBySection[section] = [];
    }
    updateEntry({
      available: true,
      activeSections: sections,
      photosBySection,
    });
  };

  const addLocalPhotos = async (section: string, sources: Array<File | string>) => {
    if (sources.length === 0) return;
    beginPhotoUpload();
    try {
      const uploadedUrls = await uploadInspectionPhotos(
        id,
        sources,
        inspectionPhotoAreaLabel(area, section, 'single'),
      );
      setDraft((prev) => {
        const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
        return {
          ...prev,
          entries: {
            ...prev.entries,
            [area]: {
              ...current,
              photosBySection: {
                ...current.photosBySection,
                [section]: [
                  ...(current.photosBySection[section] ?? []),
                  ...uploadedUrls,
                ],
              },
            },
          },
        };
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not upload photo',
      );
    } finally {
      endPhotoUpload();
    }
  };

  const addAreaPhotos = async (sources: Array<File | string>) => {
    if (sources.length === 0) return;
    beginPhotoUpload();
    try {
      const uploadedUrls = await uploadInspectionPhotos(
        id,
        sources,
        inspectionAreaOverallPhotoLabel(area),
      );
      setDraft((prev) => {
        const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
        return {
          ...prev,
          entries: {
            ...prev.entries,
            [area]: {
              ...current,
              areaPhotos: [...(current.areaPhotos ?? []), ...uploadedUrls],
            },
          },
        };
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not upload photo',
      );
    } finally {
      endPhotoUpload();
    }
  };

  const removePhoto = (section: string, index: number) => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            photosBySection: {
              ...current.photosBySection,
              [section]: (current.photosBySection[section] ?? []).filter(
                (_, i) => i !== index,
              ),
            },
          },
        },
      };
    });
  };

  const addSection = (section: string) => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      if (current.activeSections.includes(section)) return prev;
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            activeSections: [...current.activeSections, section],
          },
        },
      };
    });
  };

  const removeSection = (section: string) => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      const nextPhotos = { ...current.photosBySection };
      delete nextPhotos[section];
      const nextMarks = { ...(current.itemMarks ?? {}) };
      delete nextMarks[section];
      const nextComments = { ...(current.itemComments ?? {}) };
      delete nextComments[section];
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            activeSections: current.activeSections.filter((s) => s !== section),
            photosBySection: nextPhotos,
            itemMarks: nextMarks,
            itemComments: nextComments,
          },
        },
      };
    });
  };

  const renameSection = (from: string, to: string) => {
    if (from === to) return;
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            activeSections: current.activeSections.map((name) =>
              name === from ? to : name,
            ),
            photosBySection: rekeyRecord(current.photosBySection, from, to),
            itemMarks: rekeyRecord(current.itemMarks ?? {}, from, to),
            itemComments: rekeyRecord(current.itemComments ?? {}, from, to),
          },
        },
      };
    });
  };

  const moveSection = (from: number, to: number) => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            activeSections: moveIndex(current.activeSections, from, to),
          },
        },
      };
    });
  };

  const changeMarks = (section: string, marks: ItemConditionMarks) => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            itemMarks: { ...(current.itemMarks ?? {}), [section]: marks },
          },
        },
      };
    });
  };

  const fillColumn = (key: ItemConditionKey, value: boolean) => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            itemMarks: applyColumnMark(current.itemMarks, current.activeSections, key, value),
          },
        },
      };
    });
  };

  const changeItemComment = (section: string, comment: string) => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            itemComments: { ...(current.itemComments ?? {}), [section]: comment },
          },
        },
      };
    });
  };

  const saveArea = async () => {
    if (entry.available !== true) {
      toast.error('Confirm whether this area is available');
      return;
    }
    if (entry.activeSections.length === 0) {
      toast.error('Add at least one item, or skip this area');
      return;
    }
    const incomplete = firstIncompleteSection(
      entry.activeSections,
      entry.itemMarks,
    );
    if (incomplete) {
      toast.error(`Mark Clean, Undamaged and Working for “${incomplete}”`);
      return;
    }
    const hasAreaPhotos = (entry.areaPhotos?.length ?? 0) > 0;
    const hasItemPhotos = entry.activeSections.some(
      (section) => (entry.photosBySection[section]?.length ?? 0) > 0,
    );
    if (!hasAreaPhotos && !hasItemPhotos) {
      toast.error('Snap at least one photo for this area');
      return;
    }

    setFormBusy(true);
    try {
      const nextPhotos: Record<string, string[]> = { ...entry.photosBySection };
      for (const section of entry.activeSections) {
        const urls = entry.photosBySection[section] ?? [];
        if (urls.length === 0) continue;
        nextPhotos[section] = await commitInspectionAreaPhotos(
          id,
          sectionAreaName(area, section),
          urls,
        );
      }
      const areaPhotos = await commitInspectionAreaPhotos(
        id,
        inspectionAreaOverallPhotoLabel(area),
        entry.areaPhotos ?? [],
      );

      const committedEntry: AreaEntry = {
        ...entry,
        photosBySection: nextPhotos,
        areaPhotos,
      };
      const finalEntries = { ...entries, [area]: committedEntry };
      setDraft((prev) => ({
        ...prev,
        entries: finalEntries,
        areaIndex: isLast ? prev.areaIndex : prev.areaIndex + 1,
        ...(isLast
          ? {
              workflowStep: 'special' as const,
              specialReporting:
                mergeSpecialReporting(prev.specialReporting),
            }
          : {}),
      }));
      return;
    } catch {
      toast.error('Photo upload failed — please retry');
    } finally {
      setFormBusy(false);
    }
  };

  const finalizeAndSubmit = async (finalEntries: Record<string, AreaEntry>) => {
    // Ensure skipped trailing areas are recorded if user finishes from an earlier revisit.
    const findings: InspectorFindingAreaPayload[] = [];
    for (const def of areaCatalog) {
      const rec = finalEntries[def.name];
      if (!rec || rec.available !== true) {
        findings.push({
          name: def.name,
          items: rec?.activeSections.map((section) => ({ name: section })) ?? [],
        });
        continue;
      }
      findings.push(
        findingsAreaFromSections({
          name: def.name,
          sections: rec.activeSections,
          marksBySection: rec.itemMarks,
          commentsBySection: rec.itemComments,
          notes: rec.comments,
        }),
      );
    }

    findings.push(
      specialReportingAsFindings(
        mergeSpecialReporting(draft.specialReporting),
      ),
    );

    // Also commit any still-local photos for available areas already visited.
    for (const def of areaCatalog) {
      const rec = finalEntries[def.name];
      if (!rec || rec.available !== true) continue;
      for (const section of rec.activeSections) {
        const urls = rec.photosBySection[section] ?? [];
        if (urls.length === 0) continue;
        const needsUpload = urls.some(
          (u) => u.startsWith('data:') || u.startsWith('blob:'),
        );
        if (!needsUpload) continue;
        await commitInspectionAreaPhotos(
          id,
          sectionAreaName(def.name, section),
          urls,
        );
      }
      const areaUrls = rec.areaPhotos ?? [];
      if (areaUrls.some((u) => u.startsWith('data:') || u.startsWith('blob:'))) {
        await commitInspectionAreaPhotos(
          id,
          inspectionAreaOverallPhotoLabel(def.name),
          areaUrls,
        );
      }
    }

    const saved = await saveInspectionFindings(id, findings);
    // The draft is the only other copy of the field pass. Clearing it after a save
    // that never reached the server threw the whole inspection away and still marked
    // the job finished, so the workflow refused to reopen.
    if (!saved) {
      toast.error('Report not submitted — your photos and notes are still here', {
        description:
          'The findings could not be saved. Check your connection and complete the report again.',
      });
      return;
    }
    clearDraft();
    submitInspection(
      'Entry report sent for account manager review',
      'Awaiting approval',
    );
  };

  const goToSpecialReporting = () => {
    setDraft((prev) => ({
      ...prev,
      workflowStep: 'special',
      specialReporting: mergeSpecialReporting(prev.specialReporting),
    }));
  };

  const completeFromSkippedLast = () => {
    goToSpecialReporting();
  };

  const markAllGood = () => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            itemMarks: markAllItemsGood(current.activeSections),
          },
        },
      };
    });
  };

  const unmarkAll = () => {
    setDraft((prev) => {
      const current = prev.entries[area] ?? emptyEntry(area, prev.customAreas);
      return {
        ...prev,
        entries: {
          ...prev.entries,
          [area]: {
            ...current,
            itemMarks: markAllItemsEmpty(current.activeSections),
          },
        },
      };
    });
  };

  const progressTone = (index: number, areaName: string) => {
    const rec = entries[areaName];
    const skipped = rec?.available === false;
    const photographed =
      (rec?.areaPhotos?.length ?? 0) > 0 ||
      (rec?.activeSections ?? []).some(
        (section) => (rec?.photosBySection[section]?.length ?? 0) > 0,
      );
    const complete =
      skipped ||
      (rec?.available === true &&
        (rec.activeSections?.length ?? 0) > 0 &&
        !firstIncompleteSection(rec.activeSections, rec.itemMarks) &&
        photographed);
    return inspectionAreaProgressBarClass(index === areaIndex, complete);
  };

  const checkedCount = entry.activeSections.filter((section) =>
    marksAreComplete(entry.itemMarks?.[section]),
  ).length;
  const issueCount = entry.activeSections.filter((section) =>
    marksHaveNo(entry.itemMarks?.[section]),
  ).length;

  if (draft.workflowStep === 'special') {
    return (
      <>
        <JobWorkspaceShell job={job} active="start">
          <div className="space-y-4">
            <SpecialReportingForm
              value={mergeSpecialReporting(draft.specialReporting)}
              onChange={(specialReporting) =>
                setDraft((prev) => ({ ...prev, specialReporting }))
              }
              submitting={busy}
              phase="ingoing"
              onBack={() =>
                setDraft((prev) => ({
                  ...prev,
                  workflowStep: 'areas',
                  areaIndex: Math.max(areaCatalog.length - 1, 0),
                }))
              }
              onFinalise={() => {
                setFormBusy(true);
                void finalizeAndSubmit(entries).finally(() => setFormBusy(false));
              }}
            />
          </div>
        </JobWorkspaceShell>
        {Celebration}
      </>
    );
  }

  return (
    <>
      <JobWorkspaceShell job={job} active="start">
        <InspectionInspectChrome
          nav={
            <InspectionAreaNav
              areaCatalog={areaCatalog}
              areaIndex={areaIndex}
              progressTone={progressTone}
              onGoToArea={goToArea}
            />
          }
          footer={
            <InspectionAreaActionBar
              checked={entry.available === false ? 0 : checkedCount}
              total={entry.available === false ? 0 : entry.activeSections.length}
              issues={entry.available === false ? 0 : issueCount}
              busy={busy}
              isLast={isLast}
              onNext={() =>
                entry.available === false
                  ? isLast
                    ? completeFromSkippedLast()
                    : goToArea(areaIndex + 1)
                  : void saveArea()
              }
            />
          }
        >
          {entry.available === false ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                This area was marked unavailable. You can change that and photograph
                it, or continue.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => markAvailable(true)}
              >
                Mark available & photograph
              </Button>
            </div>
          ) : (
            <>
              <InspectionAreaPhotosField
                label="Area photos"
                photoUrls={entry.areaPhotos ?? []}
                uploading={photoBusy}
                disabled={formBusy}
                sessionKey={area}
                emptyLabel="Snap several photos of this room, then attach them here."
                onAddFiles={(files) => addAreaPhotos(files)}
                onAddDataUrl={(dataUrl) => addAreaPhotos([dataUrl])}
                onAddDataUrls={(urls) => addAreaPhotos(urls)}
                onRemove={(index) =>
                  updateEntry({
                    areaPhotos: (entry.areaPhotos ?? []).filter((_, i) => i !== index),
                  })
                }
              />

              <InspectionSectionPhotos
                definition={areaDef}
                activeSections={entry.activeSections}
                photosBySection={entry.photosBySection}
                itemMarks={entry.itemMarks}
                itemComments={entry.itemComments}
                busy={formBusy}
                photoUploading={photoBusy}
                onAddSection={addSection}
                onRemoveSection={removeSection}
                onRenameSection={renameSection}
                onMoveSection={moveSection}
                onChangeMarks={changeMarks}
                onFillColumn={fillColumn}
                onMarkAllGood={markAllGood}
                onUnmarkAll={unmarkAll}
                onChangeComment={changeItemComment}
                onAddFiles={(section, files) => addLocalPhotos(section, files)}
                onAddDataUrl={(section, dataUrl) =>
                  addLocalPhotos(section, [dataUrl])
                }
                onAddDataUrls={(section, urls) => addLocalPhotos(section, urls)}
                onRemovePhoto={removePhoto}
              />

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Comments
                  <Mic className="size-3.5 text-muted-foreground" />
                </Label>
                <Input
                  placeholder="Room condition notes (voice-to-text supported)"
                  value={entry.comments}
                  onChange={(ev) => updateEntry({ comments: ev.target.value })}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                disabled={busy}
                onClick={() => markAvailable(false)}
              >
                Skip this area instead
              </Button>
            </>
          )}
        </InspectionInspectChrome>
      </JobWorkspaceShell>
      {Celebration}
    </>
  );
}
