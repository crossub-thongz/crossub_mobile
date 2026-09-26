'use client';

import { EllipsisVertical, MessageSquare, Play, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { AddCustomAreaDialog } from '@/components/inspector/add-custom-area-dialog';
import { DraggableNamedList } from '@/components/inspector/draggable-named-list';
import { InspectionWorkspaceHeader } from '@/components/inspector/inspection-workspace-header';
import { RenameLabelDialog } from '@/components/inspector/rename-label-dialog';
import { Button } from '@/components/ui/button';
import { INSPECTION_AREA_CATALOG } from '@/constants/inspection-areas';
import {
  normalizeCustomAreaName,
  type CustomAreaDefinition,
  type CustomAreaSectionMode,
} from '@/lib/custom-inspection-areas';
import type { InspectionAreaKind } from '@/lib/inspection-area-workflow';
import { validateUniqueLabel } from '@/lib/inspection-layout-edit';
import {
  layoutSourceLabel,
  setupStartLabel,
  type InspectionLayoutSource,
} from '@/lib/inspection-start-flow';
import type { InspectionJob } from '@/lib/types';

type InspectionAreaSetupPanelProps = {
  job: InspectionJob;
  kind: InspectionAreaKind;
  selectedAreaNames: string[];
  customAreas: CustomAreaDefinition[];
  existingAreaNames?: string[];
  continuing?: boolean;
  layoutSource?: InspectionLayoutSource;
  busy?: boolean;
  extraActions?: ReactNode;
  onAddBuiltInArea: (name: string) => void;
  onAddCustomArea: (name: string, sectionMode: CustomAreaSectionMode) => void;
  onRemoveArea: (name: string) => void;
  onRenameArea: (from: string, to: string) => void;
  onMoveArea: (from: number, to: number) => void;
  onAddAllExisting?: () => void;
  onComplete: () => void;
};

export function InspectionAreaSetupPanel({
  job,
  kind,
  selectedAreaNames,
  customAreas: _customAreas,
  existingAreaNames = [],
  continuing = false,
  layoutSource = 'manual',
  busy = false,
  extraActions,
  onAddBuiltInArea,
  onAddCustomArea,
  onRemoveArea,
  onRenameArea,
  onMoveArea,
  onAddAllExisting,
  onComplete,
}: InspectionAreaSetupPanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [renameFrom, setRenameFrom] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-area-menu]')
      ) {
        return;
      }
      setMenuFor(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuFor]);

  const selectedSet = new Set(selectedAreaNames.map((name) => name.toLowerCase()));
  const availableExisting = existingAreaNames.filter(
    (name) => !selectedSet.has(name.toLowerCase()),
  );
  const sourceLabel = layoutSourceLabel(layoutSource, selectedAreaNames.length);

  const addArea = (name: string, sectionMode: CustomAreaSectionMode) => {
    const normalized = normalizeCustomAreaName(name);
    const fromIngoing = existingAreaNames.find(
      (item) => item.trim().toLowerCase() === normalized.toLowerCase(),
    );
    if (fromIngoing) {
      onAddBuiltInArea(fromIngoing);
      return;
    }
    const catalog = INSPECTION_AREA_CATALOG.find(
      (area) => area.name.toLowerCase() === normalized.toLowerCase(),
    );
    if (catalog) onAddBuiltInArea(catalog.name);
    else onAddCustomArea(normalized, sectionMode);
  };

  return (
    <div className="space-y-4 pb-4">
      <InspectionWorkspaceHeader job={job} />

      {extraActions}

      {sourceLabel ? (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-foreground">
          {sourceLabel}
        </p>
      ) : null}

      {availableExisting.length > 0 && onAddAllExisting ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={onAddAllExisting}
        >
          Add remaining from Entry report ({availableExisting.length})
        </Button>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-foreground text-sm font-bold tracking-wide uppercase">
            Property areas
          </h2>
          <span className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums">
            {selectedAreaNames.length}
          </span>
          <button
            type="button"
            className="text-primary ml-auto text-sm font-semibold"
            disabled={busy}
            onClick={() => setAddOpen(true)}
          >
            <Plus className="mr-0.5 inline size-4" />
            Add Area
          </button>
        </div>
        <p className="text-muted-foreground text-xs">
          {continuing
            ? 'Hold the green handle for a moment until the row pops up, then drag to rearrange. You can also add, remove, or rename areas after the inspection has started.'
            : 'Hold the green handle for a moment until the row pops up, then drag to rearrange.'}
        </p>

        <ul className="border-border bg-card divide-y overflow-visible rounded-2xl border">
          {selectedAreaNames.length === 0 ? (
            <li className="text-muted-foreground px-4 py-6 text-center text-xs">
              Add at least one area, then start the inspection.
            </li>
          ) : (
            <DraggableNamedList
              items={selectedAreaNames}
              disabled={busy}
              onReorder={onMoveArea}
              renderItem={(name) => (
                <>
                  <p className="text-foreground min-w-0 flex-1 text-sm font-medium">{name}</p>
                  <div
                    className="relative shrink-0"
                    data-area-menu
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground flex size-9 items-center justify-center rounded-md"
                      aria-label={`More actions for ${name}`}
                      disabled={busy}
                      onClick={() =>
                        setMenuFor((current) => (current === name ? null : name))
                      }
                    >
                      <EllipsisVertical className="size-4" />
                    </button>
                    {menuFor === name ? (
                      <div className="border-border bg-card absolute right-0 bottom-full z-50 mb-1 min-w-[8.5rem] overflow-hidden rounded-lg border shadow-lg">
                        <button
                          type="button"
                          className="hover:bg-secondary w-full px-3 py-2 text-left text-xs"
                          onClick={() => {
                            setMenuFor(null);
                            setRenameFrom(name);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-destructive hover:bg-destructive/10 w-full px-3 py-2 text-left text-xs"
                          onClick={() => {
                            setMenuFor(null);
                            onRemoveArea(name);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            />
          )}
        </ul>
      </section>

      <Button
        type="button"
        className="mt-2 w-full"
        disabled={busy || selectedAreaNames.length === 0}
        onClick={onComplete}
      >
        <Play className="size-4 fill-current" />
        {continuing ? setupStartLabel(kind, true) : 'Start Inspection'}
      </Button>

      <AddCustomAreaDialog
        open={addOpen}
        existingNames={selectedAreaNames}
        onClose={() => setAddOpen(false)}
        onConfirm={(name, sectionMode) => addArea(name, sectionMode)}
      />

      <RenameLabelDialog
        open={Boolean(renameFrom)}
        title="Rename area"
        initialValue={renameFrom ?? ''}
        onClose={() => setRenameFrom(null)}
        onConfirm={(value) => {
          if (!renameFrom) return null;
          const error = validateUniqueLabel(value, selectedAreaNames, renameFrom);
          if (error) return error;
          onRenameArea(renameFrom, normalizeCustomAreaName(value));
          return null;
        }}
      />
    </div>
  );
}

export function RoutinePreInspectionSmsButton({
  href,
  disabled,
}: {
  href: string;
  disabled?: boolean;
}) {
  return (
    <Button type="button" variant="outline" className="w-full" disabled={disabled} asChild>
      <a href={href}>
        <MessageSquare className="size-4" />
        Send pre-inspection SMS
      </a>
    </Button>
  );
}
