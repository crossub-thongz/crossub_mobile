'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { InspectionAreaActionBar } from '@/components/inspector/inspection-area-action-bar';
import { InspectionAreaPhotosField } from '@/components/inspector/inspection-area-photos-field';
import { InspectionAreaNav, inspectionAreaProgressBarClass } from '@/components/inspector/inspection-area-nav';
import { InspectionAreaSetupPanel, RoutinePreInspectionSmsButton } from '@/components/inspector/inspection-area-setup-panel';
import { InspectionInspectChrome } from '@/components/inspector/inspection-inspect-chrome';
import { JobLookupFallback } from '@/components/inspector/job-lookup-fallback';
import { KeyCollectionRequired } from '@/components/inspector/key-collection-required';
import { InspectorShell } from '@/components/layout/inspector-shell';
import { JobWorkspaceShell } from '@/components/inspector/job-workspace-shell';
import { ResetInspectionDialog } from '@/components/inspector/reset-inspection-dialog';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  appendSelectedAreaName,
  buildExecutionAreaCatalog,
  classifyAddedAreaName,
  effectiveSelectedAreaNames,
  omitNamedRecordKey,
  removeSelectedAreaName,
  type CustomAreaSectionMode,
} from '@/lib/custom-inspection-areas';
import { jobDetail, jobInspect, ROUTES } from '@/constants/routes';
import { useFinishInspection } from '@/hooks/use-finish-inspection';
import { useInspectionExecutionDraft } from '@/hooks/use-inspection-execution-draft';
import { inspectionAreaOverallPhotoLabel } from '@/lib/inspection-area-photos';
import {
  useAwaitingAgentPaymentGate,
  useInspectionFinishedGate,
  useInspectionInProgress,
  useKeyCollectGate,
} from '@/hooks/use-key-collect-gate';
import { fetchInspectionDetail, clearInspectionAreaPhotos } from '@/lib/crossub-api/inspector-client';
import {
  applyRoutineDetailPhotos,
  emptyRoutineIssue,
  mergeRoutineExecutionDraft,
} from '@/lib/inspection-execution-hydration';
import type { RoutineAreaIssueDraft, RoutineExecutionDraft } from '@/lib/inspection-execution-draft';
import {
  existingAreaNamesFromPlan,
  isAreaSetupComplete,
  resolveIngoingAreaPlan,
  sectionsForAvailableArea,
  seedAreasForInspectionStart,
} from '@/lib/inspection-area-workflow';
import {
  draftNeedsLayoutSeed,
  layoutFromIngoingPlan,
  layoutTemplateFromProperty,
  mergeCustomAreas,
} from '@/lib/inspection-layout-template';
import { scrollInspectionWorkspaceToTop } from '@/lib/utils';
import { preInspectionSmsHref } from '@/lib/inspection-start-flow';
import {
  referenceIngoingAreaPlan,
  type IngoingAreaPlan,
} from '@/lib/ingoing-area-plan';
import { findingsAreaFromSections } from '@/lib/inspection-findings-items';
import { moveIndex, rekeyRecord, renameCustomArea } from '@/lib/inspection-layout-edit';
import { jobLookupMiss } from '@/lib/job-lookup';
import { parseJobWorkspaceView } from '@/lib/job-workspace-view';

type AreaIssue = RoutineAreaIssueDraft;

const emptySectionPhotos = () => ({
  ingoingPhotoUrls: [] as string[],
  outgoingPhotoUrls: [] as string[],
});

function emptyAreaIssue(areaName: string): AreaIssue {
  return emptyRoutineIssue(areaName);
}

export default function RoutineInspectionPage() {
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

  const { draft, setDraft, clearDraft, resetDraft, localDraftLoaded } =
    useInspectionExecutionDraft(id, job, 'routine', (): RoutineExecutionDraft => ({
      kind: 'routine',
      areaIndex: 0,
      method: 'physical',
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
  const [resetOpen, setResetOpen] = useState(false);
  const [loadingReference, setLoadingReference] = useState(apiConnected);
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
        const plan = resolveIngoingAreaPlan(
          referenceIngoingAreaPlan(detail),
          refAreas,
        );
        setIngoingAreaPlan(plan);

        setDraft((prev) => {
          const copied = layoutFromIngoingPlan(plan, { includeSections: false });
          const hasUserProgress =
            prev.areaSetupComplete === true ||
            (prev.selectedAreaNames?.length ?? 0) > 0 ||
            Object.values(prev.issues).some((issue) => issue.available != null);

          if (!hasUserProgress && !copied) {
            return prev;
          }

          const nextCustom = mergeCustomAreas(
            prev.customAreas ?? [],
            copied?.customAreas ?? [],
          );
          const seedNames =
            draftNeedsLayoutSeed(prev) && copied
              ? copied.names
              : prev.selectedAreaNames ?? [];

          const nextIssues: Record<string, AreaIssue> = { ...prev.issues };
          for (const name of seedNames) {
            if (nextIssues[name]) continue;
            nextIssues[name] = emptyAreaIssue(name);
          }

          const withServerPhotos = applyRoutineDetailPhotos(nextIssues, detail);
          const merged = mergeRoutineExecutionDraft(
            {
              kind: 'routine',
              areaIndex: prev.areaIndex,
              method: prev.method,
              issues: withServerPhotos,
              customAreas: nextCustom,
              selectedAreaNames: seedNames.length > 0 ? seedNames : prev.selectedAreaNames,
            },
            prev,
          );
          if (copied && draftNeedsLayoutSeed(prev)) {
            merged.selectedAreaNames = copied.names;
            merged.customAreas = nextCustom;
          }
          return merged;
        });

        if (plan?.rooms.length) {
          toast.success(
            `Loaded ${plan.rooms.length} area(s) from the Entry report`,
          );
        } else if (reference) {
          toast.message('No completed Entry report found for this property');
        }
      } catch {
        if (!cancelled) toast.error('Could not load latest ingoing photos');
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
        layoutFromIngoingPlan(ingoingAreaPlan, { includeSections: false }) ??
        layoutTemplateFromProperty(job.property);
      if (!draftNeedsLayoutSeed(prev, layout.names)) return prev;
      const nextCustom = mergeCustomAreas(prev.customAreas ?? [], layout.customAreas);
      const nextIssues: typeof prev.issues = {};
      for (const name of layout.names) {
        nextIssues[name] = prev.issues[name] ?? emptyAreaIssue(name);
      }
      return {
        ...prev,
        selectedAreaNames: layout.names,
        customAreas: nextCustom,
        issues: nextIssues,
      };
    });
  }, [job, loadingReference, ingoingAreaPlan, setDraft]);

  const method = draft.method;
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
          sectionsForAvailableArea(name, custom, ingoingAreaPlan, 'routine'),
        emptyEntry: (name) => emptyAreaIssue(name),
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
      const { record } = seedAreasForInspectionStart(prev.issues, selected, {
        sectionsFor: (name) =>
          sectionsForAvailableArea(name, custom, ingoingAreaPlan, 'routine'),
        emptyEntry: (name) => emptyAreaIssue(name),
        emptyPhotos: emptySectionPhotos,
      });
      return {
        ...prev,
        selectedAreaNames: selected,
        areaSetupComplete: true,
        issues: record,
      };
    });
  }, [searchParams, setDraft, ingoingAreaPlan]);

  const resetInspection = async () => {
    setResetOpen(false);
    setFormBusy(true);
    try {
      if (apiConnected) {
        try {
          const detail = await fetchInspectionDetail(id);
          const areaNames = [
            ...new Set(
              detail.areas
                .map((area) => area.name?.trim())
                .filter((name): name is string => Boolean(name)),
            ),
          ];
          await Promise.all(
            areaNames.map((areaName) => clearInspectionAreaPhotos(id, areaName)),
          );
        } catch {
          // Best effort — local reset still applies.
        }
      }
      resetDraft();
      toast.success('Routine inspection reset — start again from area setup');
    } catch {
      toast.error('Could not reset inspection');
    } finally {
      setFormBusy(false);
    }
  };

  const resetControls = (
    <>
      <Button
        type="button"
        variant="outline"
        className="border-destructive/40 text-destructive hover:bg-destructive/10 w-full"
        disabled={busy || loadingReference}
        onClick={() => setResetOpen(true)}
      >
        Reset inspection
      </Button>
      <ResetInspectionDialog
        open={resetOpen}
        busy={busy}
        onClose={() => setResetOpen(false)}
        onConfirm={() => void resetInspection()}
      />
    </>
  );

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
          prev.issues[classified.name] ?? emptyAreaIssue(classified.name),
      };
      if (setupComplete) {
        nextIssues = seedAreasForInspectionStart(nextIssues, [classified.name], {
          sectionsFor: (areaName) =>
            sectionsForAvailableArea(areaName, nextCustom, ingoingAreaPlan, 'routine'),
          emptyEntry: (areaName) => emptyAreaIssue(areaName),
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
      const extras = layoutFromIngoingPlan(ingoingAreaPlan, {
        includeSections: false,
      })?.customAreas ?? [];
      const nextCustom = mergeCustomAreas(prev.customAreas ?? [], extras);
      const nextSelected = [...(prev.selectedAreaNames ?? []), ...names];
      const nextIssues = { ...prev.issues };
      for (const name of names) {
        if (!nextIssues[name]) nextIssues[name] = emptyAreaIssue(name);
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
    setDraft((prev) => {
      const custom = prev.customAreas ?? [];
      const selected = effectiveSelectedAreaNames(
        prev.selectedAreaNames,
        prev.issues,
        custom,
      );
      const { record } = seedAreasForInspectionStart(prev.issues, selected, {
        sectionsFor: (name) =>
          sectionsForAvailableArea(name, custom, ingoingAreaPlan, 'routine'),
        emptyEntry: (name) => emptyAreaIssue(name),
        emptyPhotos: emptySectionPhotos,
      });
      return {
        ...prev,
        selectedAreaNames: selected,
        areaSetupComplete: true,
        areaIndex: prev.areaSetupComplete ? prev.areaIndex : 0,
        issues: record,
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
      <InspectorShell title="Routine Inspection" backHref={jobDetail(id)}>
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
        <div className="space-y-4">
          {resetControls}
          <InspectionAreaSetupPanel
            job={job}
            kind="routine"
            selectedAreaNames={selectedAreaNames}
            customAreas={customAreas}
            existingAreaNames={ingoingExistingAreas}
            continuing={areaSetupComplete || selectedAreaNames.length > 0 || areaIndex > 0}
            layoutSource={
              ingoingExistingAreas.length > 0
                ? 'copied'
                : selectedAreaNames.length > 0
                  ? 'template'
                  : 'manual'
            }
            busy={busy || loadingReference}
            extraActions={
              <>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={method === 'physical' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, method: 'physical' }))
                    }
                  >
                    Physical
                  </Button>
                  <Button
                    type="button"
                    variant={method === 'self' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, method: 'self' }))
                    }
                  >
                    Tenant self-inspect
                  </Button>
                </div>
                {job.tenantPhone ? (
                  <RoutinePreInspectionSmsButton
                    href={preInspectionSmsHref(job) ?? '#'}
                    disabled={busy}
                  />
                ) : null}
              </>
            }
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
        </div>
      </JobWorkspaceShell>
    );
  }

  if (areaCatalog.length === 0) {
    return (
      <InspectorShell title="Routine Inspection" backHref={jobDetail(id)}>
        <p className="text-muted-foreground text-sm">No areas selected for this inspection.</p>
      </InspectorShell>
    );
  }

  const areaDef = areaCatalog[areaIndex];
  const area = areaDef?.name ?? areaCatalog[0]?.name ?? 'Area';
  const rawIssue = issues[area] ?? emptyAreaIssue(area);
  const issue =
    rawIssue.available != null
      ? rawIssue
      : (seedAreasForInspectionStart({ [area]: rawIssue }, [area], {
          sectionsFor: (name) =>
            sectionsForAvailableArea(name, customAreas, ingoingAreaPlan, 'routine'),
          emptyEntry: (name) => emptyAreaIssue(name),
          emptyPhotos: emptySectionPhotos,
        }).record[area] ?? rawIssue);
  const isLast = areaIndex === areaCatalog.length - 1;

  const updateIssue = (patch: Partial<AreaIssue>) => {
    setDraft((prev) => {
      const current = prev.issues[area] ?? emptyAreaIssue(area);
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

  const markAvailable = (available: boolean) => {
    if (!available) {
      setDraft((prev) => ({
        ...prev,
        issues: {
          ...prev.issues,
          [area]: {
            ...emptyAreaIssue(area),
            available: false,
            activeSections: [],
            photosBySection: {},
          },
        },
        areaIndex: !isLast ? prev.areaIndex + 1 : prev.areaIndex,
      }));
      return;
    }

    updateIssue({
      available: true,
      activeSections: [],
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
        const current = prev.issues[area] ?? emptyAreaIssue(area);
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

  const finalizeAndSubmit = async (finalIssues: Record<string, AreaIssue>) => {
    const saved = await saveInspectionFindings(id, [
      {
        name: 'General',
        items: [
          {
            name: 'Method',
            comment:
              method === 'physical'
                ? 'Physical inspection'
                : 'Tenant self-assessment review',
          },
        ],
      },
      ...areaCatalog.filter((def) => {
        const rec = finalIssues[def.name];
        return rec?.available === true;
      }).map((def) => {
        const rec = finalIssues[def.name];
        return findingsAreaFromSections({
          name: def.name,
          sections: [],
          notes: rec.notes,
        });
      }),
    ]);
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
    submitInspection('Routine report sent to agent and landlord');
  };

  const next = async () => {
    if (issue.available !== true) {
      toast.error('Confirm whether this area is available');
      return;
    }
    if ((issue.areaPhotos?.length ?? 0) === 0) {
      toast.error('Snap at least one photo of this room');
      return;
    }

    setFormBusy(true);
    try {
      const areaPhotos = await commitInspectionAreaPhotos(
        id,
        inspectionAreaOverallPhotoLabel(area),
        issue.areaPhotos ?? [],
      );
      const committed: AreaIssue = {
        ...issue,
        activeSections: [],
        areaPhotos,
      };
      const nextIssues = { ...issues, [area]: committed };
      setDraft((prev) => ({
        ...prev,
        issues: nextIssues,
        areaIndex: isLast ? prev.areaIndex : prev.areaIndex + 1,
      }));
      if (isLast) {
        await finalizeAndSubmit(nextIssues);
        return;
      }
    } catch {
      toast.error('Photo upload failed — please retry');
    } finally {
      setFormBusy(false);
    }
  };

  const completeFromSkippedLast = async () => {
    setFormBusy(true);
    try {
      await finalizeAndSubmit(issues);
    } catch {
      toast.error('Could not complete the report');
    } finally {
      setFormBusy(false);
    }
  };

  const progressTone = (index: number, areaName: string) => {
    const rec = issues[areaName];
    const complete =
      rec?.available === false || (rec?.areaPhotos?.length ?? 0) > 0;
    return inspectionAreaProgressBarClass(index === areaIndex, complete);
  };

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
              checked={
                issue.available === true && (issue.areaPhotos?.length ?? 0) > 0
                  ? 1
                  : 0
              }
              total={issue.available === false ? 0 : 1}
              issues={0}
              busy={busy || loadingReference}
              isLast={isLast}
              onNext={() =>
                issue.available === false
                  ? isLast
                    ? void completeFromSkippedLast()
                    : goToArea(areaIndex + 1)
                  : void next()
              }
            />
          }
        >
          {loadingReference ? (
            <p className="text-muted-foreground text-xs">
              Loading latest ingoing photos…
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

              <div className="space-y-2">
                <Label>Area notes</Label>
                <Input
                  value={issue.notes}
                  onChange={(e) => updateIssue({ notes: e.target.value })}
                  placeholder={
                    method === 'physical'
                      ? 'Inspector notes'
                      : 'Review notes for tenant submission'
                  }
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
