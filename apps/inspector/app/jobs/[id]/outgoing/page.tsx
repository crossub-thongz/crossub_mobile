'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { InspectionAreaActionBar } from '@/components/inspector/inspection-area-action-bar';
import { InspectionAreaPhotosField } from '@/components/inspector/inspection-area-photos-field';
import { InspectionAreaNav, inspectionAreaProgressBarClass } from '@/components/inspector/inspection-area-nav';
import { InspectionAreaSetupPanel } from '@/components/inspector/inspection-area-setup-panel';
import { InspectionInspectChrome } from '@/components/inspector/inspection-inspect-chrome';
import { InspectionWorkspaceHeader } from '@/components/inspector/inspection-workspace-header';
import {
  OutgoingSectionPhotos,
  type SectionBeforeAfter,
} from '@/components/inspector/outgoing-section-photos';
import { SpecialReportingForm } from '@/components/inspector/special-reporting-form';
import { JobLookupFallback } from '@/components/inspector/job-lookup-fallback';
import { KeyCollectionRequired } from '@/components/inspector/key-collection-required';
import { InspectorShell } from '@/components/layout/inspector-shell';
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
import { inspectionAreaOverallPhotoLabel, inspectionPhotoAreaLabel } from '@/lib/inspection-area-photos';
import {
  useAwaitingAgentPaymentGate,
  useInspectionFinishedGate,
  useInspectionInProgress,
  useKeyCollectGate,
} from '@/hooks/use-key-collect-gate';
import { fetchInspectionDetail } from '@/lib/crossub-api/inspector-client';
import type { InspectorFindingAreaPayload } from '@/lib/crossub-api/inspector-client';
import {
  applyOutgoingDetailPhotos,
  emptyOutgoingIssue,
  mergeOutgoingExecutionDraft,
} from '@/lib/inspection-execution-hydration';
import type { OutgoingAreaIssueDraft, OutgoingExecutionDraft } from '@/lib/inspection-execution-draft';
import { jobLookupMiss } from '@/lib/job-lookup';
import { parseJobWorkspaceView } from '@/lib/job-workspace-view';
import {
  mergeSpecialReporting,
  specialReportingAsFindings,
} from '@/lib/special-reporting';
import {
  appendSelectedAreaName,
  buildEffectiveAreaCatalog,
  buildExecutionAreaCatalog,
  classifyAddedAreaName,
  effectiveSelectedAreaNames,
  omitNamedRecordKey,
  removeSelectedAreaName,
  type CustomAreaSectionMode,
} from '@/lib/custom-inspection-areas';
import {
  matchReferenceSectionPhotos,
  referenceIngoingHasPhotos,
  seedOutgoingIssuesFromReference,
} from '@/lib/outgoing-reference-photos';
import {
  buildOutgoingIssueSeed,
  referenceIngoingAreaPlan,
  type IngoingAreaPlan,
} from '@/lib/ingoing-area-plan';
import {
  existingAreaNamesFromPlan,
  isAreaSetupComplete,
  resolveIngoingAreaPlan,
  sectionsForAvailableArea,
  seedAreasForInspectionStart,
} from '@/lib/inspection-area-workflow';
import { markAllItemsEmpty, markAllItemsGood } from '@/components/inspector/inspection-section-photos';
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
  layoutFromIngoingPlan,
  layoutTemplateFromProperty,
  mergeCustomAreas,
} from '@/lib/inspection-layout-template';
import { scrollInspectionWorkspaceToTop } from '@/lib/utils';

const RESPONSIBILITY = [
  'Tenant Responsible',
  'Landlord Responsible',
  'Fair Wear & Tear',
] as const;

type AreaIssue = OutgoingAreaIssueDraft;

const emptySectionPhotos = (): SectionBeforeAfter => ({
  ingoingPhotoUrls: [],
  outgoingPhotoUrls: [],
});

function emptyAreaIssue(
  areaName: string,
  seed?: { available: boolean | null; activeSections: string[] },
  customAreas?: OutgoingExecutionDraft['customAreas'],
): AreaIssue {
  return emptyOutgoingIssue(areaName, seed, customAreas ?? []);
}

export default function OutgoingInspectionPage() {
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

  const { draft, setDraft, clearDraft, localDraftLoaded } =
    useInspectionExecutionDraft(id, job, 'outgoing', (): OutgoingExecutionDraft => ({
      kind: 'outgoing',
      areaIndex: 0,
      issues: {},
      customAreas: [],
      areaSetupComplete: false,
    }), keysCollected);
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
  const [loadingReference, setLoadingReference] = useState(apiConnected);
  const [ingoingFromReference, setIngoingFromReference] = useState(false);
  const [referenceAreas, setReferenceAreas] = useState<
    Array<{ name: string; photos: Array<{ url: string }> }>
  >([]);
  const [ingoingAreaPlan, setIngoingAreaPlan] = useState<IngoingAreaPlan | null>(
    null,
  );
  const serverHydrated = useRef(false);

  useEffect(() => {
    if (!apiConnected) serverHydrated.current = false;
  }, [apiConnected]);

  useEffect(() => {
    if (!apiConnected || !id) {
      setLoadingReference(false);
      return;
    }
    // Not loading on these paths either. Leaving the flag set here permanently
    // disabled "Complete Outgoing Report" / "Submit" — and a disabled button says
    // nothing at all, so the inspector clicks the only control that finishes the job
    // and the app simply does not react: no toast, no error, no state change.
    if (!localDraftLoaded.current || serverHydrated.current) {
      setLoadingReference(false);
      return;
    }

    let cancelled = false;
    setLoadingReference(true);
    void (async () => {
      try {
        const detail = await fetchInspectionDetail(id);
        if (cancelled) return;

        const reference = detail.referenceIngoing;
        const refAreas = reference?.areas ?? [];
        setReferenceAreas(refAreas);
        const plan = resolveIngoingAreaPlan(
          referenceIngoingAreaPlan(detail),
          refAreas,
        );
        setIngoingAreaPlan(plan);
        const hasReferencePhotos = referenceIngoingHasPhotos(refAreas);
        setIngoingFromReference(hasReferencePhotos);
        let seededFromReference = false;
        const copied = layoutFromIngoingPlan(plan);

        setDraft((prev) => {
          const copiedCustom = mergeCustomAreas(
            prev.customAreas ?? [],
            copied?.customAreas ?? [],
          );
          const seedNames =
            draftNeedsLayoutSeed(prev) && copied
              ? copied.names
              : effectiveSelectedAreaNames(
                  prev.selectedAreaNames,
                  prev.issues,
                  copiedCustom,
                );

          const catalog = buildEffectiveAreaCatalog(copiedCustom);
          const nextIssues: Record<string, AreaIssue> = { ...prev.issues };

          for (const def of catalog) {
            if (nextIssues[def.name]) continue;
            const seed = buildOutgoingIssueSeed(def, plan);
            nextIssues[def.name] = emptyAreaIssue(def.name, seed, copiedCustom);
          }

          if (copied) {
            for (const name of copied.names) {
              if (nextIssues[name]) continue;
              nextIssues[name] = emptyAreaIssue(
                name,
                buildOutgoingIssueSeed(
                  { name, defaultSections: [], optionalSections: [] },
                  plan,
                ),
                copiedCustom,
              );
            }
          }

          const seeded = seedOutgoingIssuesFromReference(nextIssues, {
            referenceAreas: refAreas,
            plan,
            customAreas: copiedCustom,
            areaNames:
              seedNames.length > 0
                ? seedNames
                : catalog.map((def) => def.name),
          });
          seededFromReference = seeded.seeded;

          const withServerPhotos = applyOutgoingDetailPhotos(
            seeded.issues,
            detail,
            copiedCustom,
          );
          const merged = mergeOutgoingExecutionDraft(
            {
              kind: 'outgoing',
              areaIndex: prev.areaIndex,
              issues: withServerPhotos,
              customAreas: copiedCustom,
              selectedAreaNames: seedNames.length > 0 ? seedNames : prev.selectedAreaNames,
            },
            prev,
          );
          if (copied && draftNeedsLayoutSeed(prev)) {
            merged.selectedAreaNames = copied.names;
            merged.customAreas = copiedCustom;
          }
          if (plan) {
            const firstAvailable = catalog.findIndex(
              (def) => merged.issues[def.name]?.available === true,
            );
            if (firstAvailable >= 0 && prev.areaIndex === 0) {
              merged.areaIndex = firstAvailable;
            }
          }
          return merged;
        });
        if (plan) {
          toast.success(
            `Loaded ${plan.rooms.length} area(s) from the Entry report`,
          );
        } else if (reference && seededFromReference) {
          toast.success('Entry photos loaded from the latest Entry report');
        } else if (!reference) {
          toast.message('No completed Entry report found for this property');
        }
      } catch {
        if (!cancelled) {
          toast.error('Could not load Entry reference photos');
        }
      } finally {
        if (!cancelled) {
          setLoadingReference(false);
          serverHydrated.current = true;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiConnected, id, setDraft, localDraftLoaded]);

  useEffect(() => {
    if (!job || loadingReference || !localDraftLoaded.current) return;
    setDraft((prev) => {
      const layout =
        layoutFromIngoingPlan(ingoingAreaPlan) ??
        layoutTemplateFromProperty(job.property);
      if (!draftNeedsLayoutSeed(prev, layout.names)) return prev;
      const nextCustom = mergeCustomAreas(prev.customAreas ?? [], layout.customAreas);
      const nextIssues: typeof prev.issues = {};
      for (const name of layout.names) {
        nextIssues[name] =
          prev.issues[name] ??
          emptyAreaIssue(
            name,
            buildOutgoingIssueSeed(
              { name, defaultSections: [], optionalSections: [] },
              ingoingAreaPlan,
            ),
            nextCustom,
          );
      }
      return {
        ...prev,
        selectedAreaNames: layout.names,
        customAreas: nextCustom,
        issues: nextIssues,
      };
    });
  }, [job, loadingReference, ingoingAreaPlan, setDraft]);

  const customAreas = draft.customAreas ?? [];
  const areaSetupComplete = isAreaSetupComplete(draft);
  const ingoingExistingAreas = existingAreaNamesFromPlan(ingoingAreaPlan);
  const selectedAreaNames = effectiveSelectedAreaNames(
    draft.selectedAreaNames,
    draft.issues,
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
  const issues = draft.issues;

  useEffect(() => {
    if (!isAreaSetupComplete(draft)) return;
    setDraft((prev) => {
      const custom = prev.customAreas ?? [];
      const selected = effectiveSelectedAreaNames(
        prev.selectedAreaNames,
        prev.issues,
        custom,
      );
      if (selected.length === 0) return prev;
      const { record, changed } = seedAreasForInspectionStart(prev.issues, selected, {
        sectionsFor: (name) =>
          sectionsForAvailableArea(name, custom, ingoingAreaPlan, 'outgoing'),
        emptyEntry: (name) => emptyAreaIssue(name, undefined, custom),
        emptyPhotos: emptySectionPhotos,
      });
      if (!changed) return prev;
      return { ...prev, selectedAreaNames: selected, issues: record };
    });
  }, [draft.areaSetupComplete, ingoingAreaPlan, setDraft]);

  useEffect(() => {
    if (searchParams.get('view') !== 'inspect') return;
    setDraft((prev) => {
      if (prev.areaSetupComplete) return prev;
      const custom = prev.customAreas ?? [];
      const selected = effectiveSelectedAreaNames(
        prev.selectedAreaNames,
        prev.issues,
        custom,
      );
      if (selected.length === 0) return prev;
      const seeded = seedAreasForInspectionStart(prev.issues, selected, {
        sectionsFor: (name) =>
          sectionsForAvailableArea(name, custom, ingoingAreaPlan, 'outgoing'),
        emptyEntry: (name) => emptyAreaIssue(name, undefined, custom),
        emptyPhotos: emptySectionPhotos,
      });
      const { issues: withReference } = seedOutgoingIssuesFromReference(seeded.record, {
        referenceAreas,
        plan: ingoingAreaPlan,
        customAreas: custom,
        areaNames: selected,
      });
      return {
        ...prev,
        selectedAreaNames: selected,
        areaSetupComplete: true,
        issues: withReference,
      };
    });
  }, [searchParams, setDraft, ingoingAreaPlan, referenceAreas]);

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
        prev.issues,
        nextCustom,
      );
      let nextIssues = {
        ...prev.issues,
        [classified.name]:
          prev.issues[classified.name] ??
          emptyAreaIssue(classified.name, undefined, nextCustom),
      };
      if (setupComplete) {
        nextIssues = seedAreasForInspectionStart(nextIssues, [classified.name], {
          sectionsFor: (areaName) =>
            sectionsForAvailableArea(areaName, nextCustom, ingoingAreaPlan, 'outgoing'),
          emptyEntry: (areaName) => emptyAreaIssue(areaName, undefined, nextCustom),
          emptyPhotos: emptySectionPhotos,
        }).record;
      }
      return {
        ...prev,
        customAreas: nextCustom,
        selectedAreaNames: nextSelected,
        areaIndex: setupComplete
          ? Math.max(0, nextSelected.findIndex((item) => item === classified.name))
          : prev.areaIndex,
        issues: nextIssues,
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
        prev.issues,
        prev.customAreas ?? [],
      );
      const nextCustom = (prev.customAreas ?? []).filter(
        (item) => item.name.trim().toLowerCase() !== name.trim().toLowerCase(),
      );
      return {
        ...prev,
        selectedAreaNames: nextSelected,
        customAreas: nextCustom,
        issues: omitNamedRecordKey(prev.issues, name),
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
          prev.issues,
          prev.customAreas ?? [],
        ),
        from,
        to,
      ),
    }));
  };

  const handleRenameSetupArea = (from: string, to: string) => {
    if (from === to) return;
    setDraft((prev) => ({
      ...prev,
      selectedAreaNames: (prev.selectedAreaNames ?? []).map((name) =>
        name === from ? to : name,
      ),
      customAreas: renameCustomArea(prev.customAreas ?? [], from, to),
      issues: rekeyRecord(prev.issues, from, to),
    }));
  };

  const addAllFromIngoing = () => {
    const names = ingoingExistingAreas.filter(
      (name) =>
        !selectedAreaNames.some(
          (selected) => selected.toLowerCase() === name.toLowerCase(),
        ),
    );
    if (names.length === 0) return;
    setDraft((prev) => {
      const extras = layoutFromIngoingPlan(ingoingAreaPlan)?.customAreas ?? [];
      const nextCustom = mergeCustomAreas(prev.customAreas ?? [], extras);
      const nextSelected = [...(prev.selectedAreaNames ?? []), ...names];
      const nextIssues = { ...prev.issues };
      for (const name of names) {
        if (!nextIssues[name]) {
          nextIssues[name] = emptyAreaIssue(name, undefined, nextCustom);
        }
      }
      return {
        ...prev,
        selectedAreaNames: nextSelected,
        customAreas: nextCustom,
        issues: nextIssues,
      };
    });
    toast.success(`Added ${names.length} area(s) from the Entry report`);
  };

  const completeAreaSetup = () => {
    if (referenceIngoingHasPhotos(referenceAreas)) {
      setIngoingFromReference(true);
    }
    setDraft((prev) => {
      const custom = prev.customAreas ?? [];
      const selected = effectiveSelectedAreaNames(
        prev.selectedAreaNames,
        prev.issues,
        custom,
      );
      const seeded = seedAreasForInspectionStart(prev.issues, selected, {
        sectionsFor: (name) =>
          sectionsForAvailableArea(name, custom, ingoingAreaPlan, 'outgoing'),
        emptyEntry: (name) => emptyAreaIssue(name, undefined, custom),
        emptyPhotos: emptySectionPhotos,
      });
      const { issues: withReference } = seedOutgoingIssuesFromReference(seeded.record, {
        referenceAreas,
        plan: ingoingAreaPlan,
        customAreas: custom,
        areaNames: selected,
      });
      return {
        ...prev,
        selectedAreaNames: selected,
        areaSetupComplete: true,
        areaIndex: prev.areaSetupComplete ? prev.areaIndex : 0,
        issues: withReference,
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
      <InspectorShell title="Final Inspection" backHref={jobDetail(id)}>
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
          kind="outgoing"
          selectedAreaNames={selectedAreaNames}
          customAreas={customAreas}
          existingAreaNames={ingoingExistingAreas}
          continuing={areaSetupComplete || selectedAreaNames.length > 0 || areaIndex > 0}
          layoutSource={
            ingoingExistingAreas.length > 0 ? 'copied' : selectedAreaNames.length > 0 ? 'template' : 'manual'
          }
          busy={busy || loadingReference}
          onAddBuiltInArea={handleAddBuiltInArea}
          onAddCustomArea={handleAddCustomArea}
          onRemoveArea={handleRemoveSetupArea}
          onRenameArea={handleRenameSetupArea}
          onMoveArea={handleMoveSetupArea}
          onAddAllExisting={ingoingExistingAreas.length > 0 ? addAllFromIngoing : undefined}
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
      <InspectorShell title="Final Inspection" backHref={jobDetail(id)}>
        <p className="text-muted-foreground text-sm">No areas selected for this inspection.</p>
      </InspectorShell>
    );
  }

  const areaDef = areaCatalog[areaIndex];
  const area = areaDef?.name ?? areaCatalog[0]?.name ?? 'Area';
  const rawIssue = issues[area] ?? emptyAreaIssue(area, undefined, customAreas);
  const issue =
    rawIssue.available != null
      ? rawIssue
      : (seedAreasForInspectionStart({ [area]: rawIssue }, [area], {
          sectionsFor: (name) =>
            sectionsForAvailableArea(name, customAreas, ingoingAreaPlan, 'outgoing'),
          emptyEntry: (name) => emptyAreaIssue(name, undefined, customAreas),
          emptyPhotos: emptySectionPhotos,
        }).record[area] ?? rawIssue);
  const isLast = areaIndex === areaCatalog.length - 1;

  const updateIssue = (patch: Partial<AreaIssue>) => {
    setDraft((prev) => {
      const current = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      return {
        ...prev,
        issues: { ...prev.issues, [area]: { ...current, ...patch } },
      };
    });
  };

  const goToArea = (index: number) => {
    if (index < 0 || index >= areaCatalog.length) return;
    setDraft((prev) => ({ ...prev, areaIndex: index }));
    scrollInspectionWorkspaceToTop();
  };

  const seedSectionIngoing = (section: string): string[] => {
    if (referenceAreas.length === 0) return [];
    return matchReferenceSectionPhotos(area, section, referenceAreas);
  };

  const markAvailable = (available: boolean) => {
    if (!available) {
      setDraft((prev) => ({
        ...prev,
        issues: {
          ...prev.issues,
          [area]: {
            ...emptyAreaIssue(area, undefined, prev.customAreas),
            available: false,
            activeSections: [],
            photosBySection: {},
          },
        },
        areaIndex: !isLast ? prev.areaIndex + 1 : prev.areaIndex,
      }));
      return;
    }

    const photosBySection: Record<string, SectionBeforeAfter> = {
      ...(issues[area]?.photosBySection ?? {}),
    };
    const sections = sectionsForAvailableArea(
      area,
      customAreas,
      ingoingAreaPlan,
      'outgoing',
    );
    for (const section of sections) {
      if (!photosBySection[section]) {
        photosBySection[section] = {
          ...emptySectionPhotos(),
          ingoingPhotoUrls: seedSectionIngoing(section),
        };
      }
    }
    updateIssue({
      available: true,
      activeSections: [...sections],
      photosBySection,
    });
  };

  const addLocalPhotos = async (
    section: string,
    side: 'ingoing' | 'outgoing',
    sources: Array<File | string>,
  ) => {
    if (sources.length === 0) return;
    if (side === 'ingoing') return;
    beginPhotoUpload();
    try {
      const uploadedUrls = await uploadInspectionPhotos(
        id,
        sources,
        inspectionPhotoAreaLabel(area, section, side),
      );
      setDraft((prev) => {
        const rec = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
        const existing = rec.photosBySection[section] ?? emptySectionPhotos();
        const key = side === 'ingoing' ? 'ingoingPhotoUrls' : 'outgoingPhotoUrls';
        return {
          ...prev,
          issues: {
            ...prev.issues,
            [area]: {
              ...rec,
              photosBySection: {
                ...rec.photosBySection,
                [section]: {
                  ...existing,
                  [key]: [...existing[key], ...uploadedUrls],
                },
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

  const removePhoto = (
    section: string,
    side: 'ingoing' | 'outgoing',
    index: number,
  ) => {
    if (side === 'ingoing') return;
    setDraft((prev) => {
      const rec = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      const existing = rec.photosBySection[section] ?? emptySectionPhotos();
      const key = side === 'ingoing' ? 'ingoingPhotoUrls' : 'outgoingPhotoUrls';
      return {
        ...prev,
        issues: {
          ...prev.issues,
          [area]: {
            ...rec,
            photosBySection: {
              ...rec.photosBySection,
              [section]: {
                ...existing,
                [key]: existing[key].filter((_, i) => i !== index),
              },
            },
          },
        },
      };
    });
  };

  const addSection = (section: string) => {
    setDraft((prev) => {
      const current = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      if (current.activeSections.includes(section)) return prev;
      return {
        ...prev,
        issues: {
          ...prev.issues,
          [area]: {
            ...current,
            activeSections: [...current.activeSections, section],
            photosBySection: {
              ...current.photosBySection,
              [section]: {
                ...emptySectionPhotos(),
                ingoingPhotoUrls: seedSectionIngoing(section),
              },
            },
          },
        },
      };
    });
  };

  const removeSection = (section: string) => {
    setDraft((prev) => {
      const current = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      const nextPhotos = { ...current.photosBySection };
      delete nextPhotos[section];
      const nextMarks = { ...(current.itemMarks ?? {}) };
      delete nextMarks[section];
      const nextComments = { ...(current.itemComments ?? {}) };
      delete nextComments[section];
      return {
        ...prev,
        issues: {
          ...prev.issues,
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
      const current = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      return {
        ...prev,
        issues: {
          ...prev.issues,
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
      const current = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      return {
        ...prev,
        issues: {
          ...prev.issues,
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
      const current = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      return {
        ...prev,
        issues: {
          ...prev.issues,
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
      const current = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      return {
        ...prev,
        issues: {
          ...prev.issues,
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
      const current = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      return {
        ...prev,
        issues: {
          ...prev.issues,
          [area]: {
            ...current,
            itemComments: { ...(current.itemComments ?? {}), [section]: comment },
          },
        },
      };
    });
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
        const current = prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
        return {
          ...prev,
          issues: {
            ...prev.issues,
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

  const next = async () => {
    if (issue.available !== true) {
      toast.error('Confirm whether this area is available');
      return;
    }
    if (issue.activeSections.length === 0) {
      toast.error('Add at least one item, or skip this area');
      return;
    }
    const incomplete = firstIncompleteSection(
      issue.activeSections,
      issue.itemMarks,
    );
    if (incomplete) {
      toast.error(`Mark Clean, Undamaged and Working for “${incomplete}”`);
      return;
    }
    const hasAreaPhotos = (issue.areaPhotos?.length ?? 0) > 0;
    const hasOutgoingPhotos = issue.activeSections.some(
      (section) =>
        (issue.photosBySection[section]?.outgoingPhotoUrls.length ?? 0) > 0,
    );
    if (!hasAreaPhotos && !hasOutgoingPhotos) {
      toast.error('Snap at least one photo for this area');
      return;
    }

    setFormBusy(true);
    try {
      const nextPhotos: Record<string, SectionBeforeAfter> = {
        ...issue.photosBySection,
      };
      for (const section of issue.activeSections) {
        const photos = issue.photosBySection[section] ?? emptySectionPhotos();
        const ingoingAreaName = `${sectionAreaName(area, section)} (Ingoing)`;
        const outgoingAreaName = `${sectionAreaName(area, section)} (Outgoing)`;
        const [ingoingUrls, outgoingUrls] = await Promise.all([
          photos.ingoingPhotoUrls.length > 0
            ? commitInspectionAreaPhotos(id, ingoingAreaName, photos.ingoingPhotoUrls)
            : Promise.resolve([] as string[]),
          photos.outgoingPhotoUrls.length > 0
            ? commitInspectionAreaPhotos(id, outgoingAreaName, photos.outgoingPhotoUrls)
            : Promise.resolve([] as string[]),
        ]);
        nextPhotos[section] = {
          ingoingPhotoUrls:
            ingoingUrls.length > 0 ? ingoingUrls : photos.ingoingPhotoUrls,
          outgoingPhotoUrls:
            outgoingUrls.length > 0 ? outgoingUrls : photos.outgoingPhotoUrls,
        };
      }
      const areaPhotos = await commitInspectionAreaPhotos(
        id,
        inspectionAreaOverallPhotoLabel(area),
        issue.areaPhotos ?? [],
      );

      const committedIssue: AreaIssue = {
        ...issue,
        photosBySection: nextPhotos,
        areaPhotos,
      };
      const nextIssues = { ...issues, [area]: committedIssue };
      setDraft((prev) => ({
        ...prev,
        issues: nextIssues,
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
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Photo upload failed — please retry',
      );
    } finally {
      setFormBusy(false);
    }
  };

  const finalizeAndSubmit = async (finalIssues: Record<string, AreaIssue>) => {
    const areas: InspectorFindingAreaPayload[] = areaCatalog.filter((def) => {
        const rec = finalIssues[def.name];
        return (
          rec &&
          rec.available === true &&
          (rec.note.trim() ||
            rec.responsibility ||
            rec.activeSections.some((section) => {
              const p = rec.photosBySection[section];
              return (
                (p?.ingoingPhotoUrls.length ?? 0) > 0 ||
                (p?.outgoingPhotoUrls.length ?? 0) > 0
              );
            }))
        );
      }).map((def) => {
        const rec = finalIssues[def.name];
        const area = findingsAreaFromSections({
          name: def.name,
          sections: rec.activeSections,
          marksBySection: rec.itemMarks,
          commentsBySection: rec.itemComments,
          notes: rec.note,
        });
        return {
          ...area,
          items: [
            {
              name: 'Issue',
              comment: rec.note.trim() || undefined,
              flagged: true,
              conditionTags: rec.responsibility ? [rec.responsibility] : [],
            },
            ...(area.items ?? []),
          ],
        };
      });
    areas.push(
      specialReportingAsFindings(
        mergeSpecialReporting(draft.specialReporting),
      ),
    );
    const saved = await saveInspectionFindings(id, areas);
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
      'Final report sent for account manager review',
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
      const current =
        prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      return {
        ...prev,
        issues: {
          ...prev.issues,
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
      const current =
        prev.issues[area] ?? emptyAreaIssue(area, undefined, prev.customAreas);
      return {
        ...prev,
        issues: {
          ...prev.issues,
          [area]: {
            ...current,
            itemMarks: markAllItemsEmpty(current.activeSections),
          },
        },
      };
    });
  };

  const progressTone = (index: number, areaName: string) => {
    const rec = issues[areaName];
    const skipped = rec?.available === false;
    const photographed =
      (rec?.areaPhotos?.length ?? 0) > 0 ||
      (rec?.activeSections ?? []).some(
        (section) => (rec?.photosBySection[section]?.outgoingPhotoUrls.length ?? 0) > 0,
      );
    const complete =
      skipped ||
      (rec?.available === true &&
        (rec.activeSections?.length ?? 0) > 0 &&
        !firstIncompleteSection(rec.activeSections, rec.itemMarks) &&
        photographed);
    return inspectionAreaProgressBarClass(index === areaIndex, complete);
  };

  const checkedCount = issue.activeSections.filter((section) =>
    marksAreComplete(issue.itemMarks?.[section]),
  ).length;
  const issueCount = issue.activeSections.filter((section) =>
    marksHaveNo(issue.itemMarks?.[section]),
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
              phase="outgoing"
              onBack={() =>
                setDraft((prev) => ({
                  ...prev,
                  workflowStep: 'areas',
                  areaIndex: Math.max(areaCatalog.length - 1, 0),
                }))
              }
              onFinalise={() => {
                setFormBusy(true);
                void finalizeAndSubmit(issues).finally(() => setFormBusy(false));
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
              checked={issue.available === false ? 0 : checkedCount}
              total={issue.available === false ? 0 : issue.activeSections.length}
              issues={issue.available === false ? 0 : issueCount}
              busy={busy || loadingReference}
              isLast={isLast}
              onNext={() =>
                issue.available === false
                  ? isLast
                    ? completeFromSkippedLast()
                    : goToArea(areaIndex + 1)
                  : void next()
              }
            />
          }
        >
          {loadingReference ? (
            <p className="text-muted-foreground text-xs">
              Loading Entry reference photos…
            </p>
          ) : null}

          {issue.available === false ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                This area was marked unavailable. You can change that and photograph
                it, or continue.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loadingReference}
                onClick={() => markAvailable(true)}
              >
                Mark available & photograph
              </Button>
            </div>
          ) : (
            <>
              <InspectionAreaPhotosField
                label="Area photos"
                photoUrls={issue.areaPhotos ?? []}
                uploading={photoBusy || loadingReference}
                disabled={formBusy || loadingReference}
                sessionKey={area}
                emptyLabel="Snap several photos of this room, then attach them here."
                onAddFiles={(files) => addAreaPhotos(files)}
                onAddDataUrl={(dataUrl) => addAreaPhotos([dataUrl])}
                onAddDataUrls={(urls) => addAreaPhotos(urls)}
                onRemove={(index) =>
                  updateIssue({
                    areaPhotos: (issue.areaPhotos ?? []).filter((_, i) => i !== index),
                  })
                }
              />

              <OutgoingSectionPhotos
                definition={areaDef}
                activeSections={issue.activeSections}
                photosBySection={issue.photosBySection}
                itemMarks={issue.itemMarks}
                itemComments={issue.itemComments}
                busy={formBusy || loadingReference}
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
                onAddFiles={(section, side, files) =>
                  addLocalPhotos(section, side, files)
                }
                onAddDataUrl={(section, side, dataUrl) =>
                  addLocalPhotos(section, side, [dataUrl])
                }
                onAddDataUrls={(section, side, urls) =>
                  addLocalPhotos(section, side, urls)
                }
                onRemovePhoto={removePhoto}
              />

              <div className="space-y-2">
                <Label>Issue notes</Label>
                <Input
                  value={issue.note}
                  onChange={(e) => updateIssue({ note: e.target.value })}
                  placeholder="Damage, cleaning, missing items..."
                />
              </div>

              <div className="space-y-2">
                <Label>Responsibility</Label>
                <div className="flex flex-wrap gap-2">
                  {RESPONSIBILITY.map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={issue.responsibility === r ? 'default' : 'outline'}
                      onClick={() => updateIssue({ responsibility: r })}
                    >
                      {r}
                    </Button>
                  ))}
                </div>
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
