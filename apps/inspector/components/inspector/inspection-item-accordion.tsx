'use client';

import { Camera, Check, ChevronDown, ChevronUp, CircleAlert, Info, Trash2 } from 'lucide-react';
import { type ReactNode } from 'react';

import { InspectionAreaPhotosField } from '@/components/inspector/inspection-area-photos-field';
import { inspectionItemIcon } from '@/lib/inspection-item-icon';
import {
  ISSUE_DETAIL_LABEL,
  ITEM_CONDITION_KEYS,
  ITEM_CONDITION_LABEL,
  cycleItemMark,
  itemMarkStatus,
  type ItemConditionKey,
  type ItemConditionMarks,
  emptyItemMarks,
} from '@/lib/item-condition-marks';
import { stripEmojis } from '@/lib/strip-emojis';
import { cn } from '@/lib/utils';

const COMMENT_MAX = 200;

export function InspectionItemAccordion({
  name,
  marks,
  comment,
  photoUrls,
  busy,
  photoUploading,
  open,
  onOpenChange,
  onRename,
  onRemove,
  onChangeMarks,
  onChangeComment,
  onAddFiles,
  onAddDataUrl,
  onAddDataUrls,
  onRemovePhoto,
  extra,
  showItemPhotos = true,
}: {
  name: string;
  marks: ItemConditionMarks | undefined;
  comment: string;
  photoUrls: string[];
  busy?: boolean;
  photoUploading?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onRemove: () => void;
  onChangeMarks: (marks: ItemConditionMarks) => void;
  onChangeComment: (comment: string) => void;
  onAddFiles?: (files: File[]) => void | Promise<void>;
  onAddDataUrl?: (dataUrl: string) => void | Promise<void>;
  onAddDataUrls?: (urls: string[]) => void | Promise<void>;
  onRemovePhoto?: (index: number) => void;
  extra?: ReactNode;
  showItemPhotos?: boolean;
}) {
  const current = marks ?? emptyItemMarks();
  const status = itemMarkStatus(current);
  const Icon = inspectionItemIcon(name);
  const photoCount = photoUrls.filter(Boolean).length;
  const missingPhotos = photoCount === 0;

  const toggleChip = (key: ItemConditionKey) => {
    onChangeMarks({
      ...current,
      [key]: cycleItemMark(current[key]),
    });
  };

  return (
    <div className="min-w-0 flex-1">
      <button
        type="button"
        className="flex w-full items-center gap-3 text-left"
        onClick={() => onOpenChange(!open)}
      >
        <span className="bg-secondary text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" />
        </span>
        <span className="text-foreground min-w-0 flex-1 text-sm font-medium leading-snug">
          {name}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              missingPhotos
                ? 'bg-amber-400/15 text-amber-400'
                : 'bg-primary/20 text-primary',
            )}
            aria-label={
              missingPhotos ? 'No photos for this item' : `${photoCount} photos for this item`
            }
          >
            <Camera className="size-3" />
            {photoCount}
          </span>
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 text-[11px] font-medium',
              status.tone === 'issue'
                ? 'text-destructive'
                : status.tone === 'good'
                  ? 'text-emerald-400'
                  : status.tone === 'partial'
                    ? 'text-amber-400'
                    : 'text-muted-foreground',
            )}
          >
            {status.tone === 'issue' ? (
              <>
                {status.label}
                <CircleAlert className="size-3.5" />
              </>
            ) : status.tone === 'good' ? (
              <>
                {status.label}
                <Check className="size-3.5" />
              </>
            ) : (
              status.label
            )}
            {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </span>
        </span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3 pl-12">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-muted-foreground text-[11px] underline"
              disabled={busy}
              onClick={onRename}
            >
              Rename item
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive inline-flex items-center gap-1 rounded-md text-[11px]"
              aria-label={`Remove ${name}`}
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          </div>

          <div>
            <p className="text-foreground mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              Condition
              <Info
                className="text-muted-foreground size-3.5"
                aria-label="Mark Clean, Undamaged and Working. Use Details if something failed."
              />
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {ITEM_CONDITION_KEYS.map((key) => {
                const value = current[key];
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    onClick={() => toggleChip(key)}
                    className={cn(
                      'rounded-lg px-2 py-2 text-[11px] font-semibold',
                      value === true && 'bg-emerald-700 text-white',
                      value === false && 'bg-destructive text-white',
                      value !== true && value !== false && 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {ITEM_CONDITION_LABEL[key]}
                    {value === true ? ' ✓' : value === false ? ' ✕' : ''}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-foreground mb-1.5 text-sm font-medium">Details</p>
            <div className="space-y-2">
              {ITEM_CONDITION_KEYS.map((key) => {
                const selected = current[key] === false;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onChangeMarks({
                        ...current,
                        [key]: selected ? null : false,
                      })
                    }
                    className="flex w-full items-center gap-2.5 text-left text-sm"
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                        selected
                          ? 'border-destructive bg-destructive'
                          : 'border-muted-foreground/50',
                      )}
                    />
                    <span className={selected ? 'text-foreground' : 'text-muted-foreground'}>
                      {ISSUE_DETAIL_LABEL[key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-medium uppercase">
              Comments
            </p>
            <textarea
              rows={3}
              maxLength={COMMENT_MAX}
              disabled={busy}
              placeholder="Describe the issue or leave blank if all good…"
              value={comment}
              onChange={(event) => onChangeComment(stripEmojis(event.target.value).slice(0, COMMENT_MAX))}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            />
            <p className="text-muted-foreground mt-1 text-right text-[10px]">
              {comment.length}/{COMMENT_MAX}
            </p>
          </div>

          {extra}

          {showItemPhotos ? (
            <InspectionAreaPhotosField
              label="Item photos"
              photoUrls={photoUrls}
              uploading={photoUploading}
              disabled={busy}
              sessionKey={name}
              compact
              emptyLabel="Take close-ups of this item."
              onAddFiles={onAddFiles ?? (() => undefined)}
              onAddDataUrl={onAddDataUrl}
              onAddDataUrls={onAddDataUrls}
              onRemove={onRemovePhoto}
            />
          ) : null}

          <button
            type="button"
            className="text-muted-foreground mx-auto flex items-center gap-1 text-xs"
            onClick={() => onOpenChange(false)}
          >
            <ChevronUp className="size-4" />
            Collapse
          </button>
        </div>
      ) : null}
    </div>
  );
}
