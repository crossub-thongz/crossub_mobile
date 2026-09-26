'use client';

import { ListFilter } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddSectionControl } from '@/components/inspector/add-section-control';
import { DraggableNamedList } from '@/components/inspector/draggable-named-list';
import { InspectionItemAccordion } from '@/components/inspector/inspection-item-accordion';
import { MarkAllItemsControl } from '@/components/inspector/inspection-section-photos';
import { RenameLabelDialog } from '@/components/inspector/rename-label-dialog';
import type { InspectionAreaDefinition } from '@/constants/inspection-areas';
import {
  emptyItemMarks,
  marksAreAllGood,
  marksHaveNo,
  type ItemConditionKey,
  type ItemConditionMarks,
} from '@/lib/item-condition-marks';
import { validateUniqueLabel } from '@/lib/inspection-layout-edit';
import { buildSectionPickerOptions } from '@/lib/inspection-section-utils';

export type SectionBeforeAfter = {
  ingoingPhotoUrls: string[];
  outgoingPhotoUrls: string[];
};

type OutgoingSectionPhotosProps = {
  definition: InspectionAreaDefinition;
  activeSections: string[];
  photosBySection: Record<string, SectionBeforeAfter>;
  itemMarks?: Record<string, ItemConditionMarks>;
  itemComments?: Record<string, string>;
  busy?: boolean;
  /** Photo upload in progress — show on Snap, do not disable the camera. */
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
  onAddFiles: (
    section: string,
    side: 'ingoing' | 'outgoing',
    files: File[],
  ) => void | Promise<void>;
  onAddDataUrl: (
    section: string,
    side: 'ingoing' | 'outgoing',
    dataUrl: string,
  ) => void | Promise<void>;
  onAddDataUrls?: (
    section: string,
    side: 'ingoing' | 'outgoing',
    dataUrls: string[],
  ) => void | Promise<void>;
  onRemovePhoto: (
    section: string,
    side: 'ingoing' | 'outgoing',
    index: number,
  ) => void;
};

export function OutgoingSectionPhotos({
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
}: OutgoingSectionPhotosProps) {
  const [renameFrom, setRenameFrom] = useState<string | null>(null);
  const [openName, setOpenName] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'issues' | 'unmarked'>('all');

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
              onClick={() =>
                setFilter((current) =>
                  current === 'all' ? 'issues' : current === 'issues' ? 'unmarked' : 'all',
                )
              }
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
                  const photos = photosBySection[section] ?? {
                    ingoingPhotoUrls: [],
                    outgoingPhotoUrls: [],
                  };
                  return (
                    <InspectionItemAccordion
                      name={section}
                      marks={itemMarks?.[section] ?? emptyItemMarks()}
                      comment={itemComments?.[section] ?? ''}
                      photoUrls={photos.outgoingPhotoUrls}
                      busy={busy}
                      photoUploading={photoUploading}
                      showItemPhotos
                      open={openName === section}
                      onOpenChange={(next) => setOpenName(next ? section : null)}
                      onRename={() => setRenameFrom(section)}
                      onRemove={() => onRemoveSection(section)}
                      onChangeMarks={(marks) => onChangeMarks(section, marks)}
                      onChangeComment={(comment) => onChangeComment(section, comment)}
                      onAddFiles={(files) => onAddFiles(section, 'outgoing', files)}
                      onAddDataUrl={(dataUrl) => onAddDataUrl(section, 'outgoing', dataUrl)}
                      onAddDataUrls={
                        onAddDataUrls
                          ? (urls) => onAddDataUrls(section, 'outgoing', urls)
                          : undefined
                      }
                      onRemovePhoto={(photoIndex) =>
                        onRemovePhoto(section, 'outgoing', photoIndex)
                      }
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
