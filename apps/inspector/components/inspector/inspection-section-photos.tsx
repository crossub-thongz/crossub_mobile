'use client';

import { useMemo, useState } from 'react';
import { Check, ListFilter } from 'lucide-react';

import { AddSectionControl } from '@/components/inspector/add-section-control';
import { DraggableNamedList } from '@/components/inspector/draggable-named-list';
import { InspectionItemAccordion } from '@/components/inspector/inspection-item-accordion';
import { RenameLabelDialog } from '@/components/inspector/rename-label-dialog';
import { ResetInspectionDialog } from '@/components/inspector/reset-inspection-dialog';
import { Button } from '@/components/ui/button';
import type { InspectionAreaDefinition } from '@/constants/inspection-areas';
import {
  allGoodMarks,
  emptyItemMarks,
  marksAreAllGood,
  marksHaveAnswer,
  marksHaveNo,
  type ItemConditionKey,
  type ItemConditionMarks,
} from '@/lib/item-condition-marks';
import { validateUniqueLabel } from '@/lib/inspection-layout-edit';
import { buildSectionPickerOptions } from '@/lib/inspection-section-utils';

type ItemFilter = 'all' | 'issues' | 'unmarked';

type InspectionSectionPhotosProps = {
  definition: InspectionAreaDefinition;
  activeSections: string[];
  photosBySection: Record<string, string[]>;
  itemMarks?: Record<string, ItemConditionMarks>;
  itemComments?: Record<string, string>;
  busy?: boolean;
  photoUploading?: boolean;
  onAddSection: (section: string) => void;
  onRemoveSection: (section: string) => void;
  onRenameSection: (from: string, to: string) => void;
  onMoveSection: (from: number, to: number) => void;
  onChangeMarks: (section: string, marks: ItemConditionMarks) => void;
  onFillColumn: (key: ItemConditionKey, value: boolean) => void;
  onMarkAllGood?: () => void;
  onUnmarkAll?: () => void;
  onChangeComment: (section: string, comment: string) => void;
  onAddFiles: (section: string, files: File[]) => void | Promise<void>;
  onAddDataUrl: (section: string, dataUrl: string) => void | Promise<void>;
  onAddDataUrls?: (section: string, dataUrls: string[]) => void | Promise<void>;
  onRemovePhoto: (section: string, index: number) => void;
};

export function MarkAllItemsControl({
  activeSections,
  itemMarks,
  busy = false,
  onMarkAllGood,
  onUnmarkAll,
}: {
  activeSections: string[];
  itemMarks?: Record<string, ItemConditionMarks>;
  busy?: boolean;
  onMarkAllGood: () => void;
  onUnmarkAll?: () => void;
}) {
  const [confirm, setConfirm] = useState<'mark' | 'unmark' | null>(null);
  const allMarkedGood =
    activeSections.length > 0 &&
    activeSections.every((section) => marksAreAllGood(itemMarks?.[section]));
  const canUnmark =
    Boolean(onUnmarkAll) &&
    activeSections.some((section) => marksHaveAnswer(itemMarks?.[section]));

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Mark items</p>
          <p className="text-muted-foreground text-[11px]">
            Mark items that apply. Unmark a section that does not need a condition.
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-emerald-400 h-8 px-2 text-xs"
            disabled={busy || allMarkedGood}
            onClick={() => setConfirm('mark')}
          >
            <Check className="size-3.5" />
            All good
          </Button>
          {onUnmarkAll ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-8 px-2 text-xs"
              disabled={busy || !canUnmark}
              onClick={() => setConfirm('unmark')}
            >
              Unmark
            </Button>
          ) : null}
        </div>
      </div>
      <ResetInspectionDialog
        open={confirm === 'mark'}
        title="Mark all items as good?"
        description="This marks Clean, Undamaged, and Working as yes for every item in this room."
        confirmLabel="Mark all good"
        cancelLabel="Cancel"
        confirmVariant="default"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          onMarkAllGood();
          setConfirm(null);
        }}
      />
      <ResetInspectionDialog
        open={confirm === 'unmark'}
        title="Unmark all items?"
        description="This clears Clean, Undamaged, and Working. Sections that do not need a mark can stay unmarked."
        confirmLabel="Unmark all"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          onUnmarkAll?.();
          setConfirm(null);
        }}
      />
    </>
  );
}

export function InspectionSectionPhotos({
  definition,
  activeSections,
  photosBySection,
  itemMarks,
  itemComments,
  busy = false,
  photoUploading = false,
  onAddSection,
  onRemoveSection,
  onRenameSection,
  onMoveSection,
  onChangeMarks,
  onFillColumn: _onFillColumn,
  onMarkAllGood,
  onUnmarkAll,
  onChangeComment,
  onAddFiles,
  onAddDataUrl,
  onAddDataUrls,
  onRemovePhoto,
}: InspectionSectionPhotosProps) {
  const [renameFrom, setRenameFrom] = useState<string | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const [filter, setFilter] = useState<ItemFilter>('all');

  const sectionPickerOptions = useMemo(
    () => buildSectionPickerOptions(definition),
    [definition],
  );

  const visibleSections = activeSections.filter((section) => {
    const marks = itemMarks?.[section];
    if (filter === 'issues') return marksHaveNo(marks);
    if (filter === 'unmarked') return !marksAreAllGood(marks) && !marksHaveNo(marks);
    return true;
  });

  const cycleFilter = () => {
    setFilter((current) =>
      current === 'all' ? 'issues' : current === 'issues' ? 'unmarked' : 'all',
    );
  };

  return (
    <div className="space-y-4">
      {onMarkAllGood && activeSections.length > 0 ? (
        <MarkAllItemsControl
          activeSections={activeSections}
          itemMarks={itemMarks}
          busy={busy}
          onMarkAllGood={onMarkAllGood}
          onUnmarkAll={onUnmarkAll}
        />
      ) : null}

      {activeSections.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No items yet. Add one below. Condition marks are optional on sections that do not apply.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Items in this area
              <span className="bg-primary text-primary-foreground ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold">
                {activeSections.length}
              </span>
            </p>
            <button
              type="button"
              className="text-muted-foreground inline-flex items-center gap-1 text-xs font-medium"
              onClick={cycleFilter}
            >
              <ListFilter className="size-3.5" />
              {filter === 'all' ? 'Filters' : filter === 'issues' ? 'Issues' : 'Unmarked'}
            </button>
          </div>
          <ul className="space-y-2">
            {visibleSections.length === 0 ? (
              <li className="text-muted-foreground rounded-xl border border-border px-3 py-4 text-center text-xs">
                No items match this filter.
              </li>
            ) : (
              <DraggableNamedList
                items={visibleSections}
                variant="card"
                disabled={busy}
                onReorder={(from, to) => {
                  const fromName = visibleSections[from];
                  const toName = visibleSections[to];
                  if (!fromName || !toName) return;
                  onMoveSection(
                    activeSections.indexOf(fromName),
                    activeSections.indexOf(toName),
                  );
                }}
                renderItem={(section) => {
                  const urls = photosBySection[section] ?? [];
                  return (
                    <InspectionItemAccordion
                      name={section}
                      marks={itemMarks?.[section] ?? emptyItemMarks()}
                      comment={itemComments?.[section] ?? ''}
                      photoUrls={urls}
                      busy={busy}
                      photoUploading={photoUploading}
                      open={openName === section}
                      onOpenChange={(next) => setOpenName(next ? section : null)}
                      onRename={() => setRenameFrom(section)}
                      onRemove={() => onRemoveSection(section)}
                      onChangeMarks={(marks) => onChangeMarks(section, marks)}
                      onChangeComment={(comment) => onChangeComment(section, comment)}
                      onAddFiles={(files) => onAddFiles(section, files)}
                      onAddDataUrl={(dataUrl) => onAddDataUrl(section, dataUrl)}
                      onAddDataUrls={
                        onAddDataUrls
                          ? (urlsToAdd) => onAddDataUrls(section, urlsToAdd)
                          : undefined
                      }
                      onRemovePhoto={(photoIndex) => onRemovePhoto(section, photoIndex)}
                    />
                  );
                }}
              />
            )}
          </ul>
        </>
      )}

      <AddSectionControl
        optionalSections={sectionPickerOptions}
        activeSections={activeSections}
        busy={busy}
        onAddSection={onAddSection}
      />

      <RenameLabelDialog
        open={Boolean(renameFrom)}
        title="Rename item"
        initialValue={renameFrom ?? ''}
        onClose={() => setRenameFrom(null)}
        onConfirm={(value) => {
          if (!renameFrom) return null;
          const error = validateUniqueLabel(value, activeSections, renameFrom);
          if (error) return error;
          onRenameSection(renameFrom, value.trim().replace(/\s+/g, ' '));
          return null;
        }}
      />
    </div>
  );
}

export function markAllItemsGood(
  sections: readonly string[],
): Record<string, ItemConditionMarks> {
  const next: Record<string, ItemConditionMarks> = {};
  for (const section of sections) next[section] = allGoodMarks();
  return next;
}

export function markAllItemsEmpty(
  sections: readonly string[],
): Record<string, ItemConditionMarks> {
  const next: Record<string, ItemConditionMarks> = {};
  for (const section of sections) next[section] = emptyItemMarks();
  return next;
}
