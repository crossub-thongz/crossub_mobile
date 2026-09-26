'use client';

import { GripVertical } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

const DRAG_THRESHOLD_PX = 8;

type DraggableNamedListProps = {
  items: string[];
  disabled?: boolean;
  /** Compact area rows, or tall item cards with the grip at the top. */
  variant?: 'row' | 'card';
  onReorder: (from: number, to: number) => void;
  renderItem: (name: string, index: number) => ReactNode;
};

export function DraggableNamedList({
  items,
  disabled = false,
  variant = 'row',
  onReorder,
  renderItem,
}: DraggableNamedListProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);
  const itemsRef = useRef(items);
  const onReorderRef = useRef(onReorder);
  itemsRef.current = items;
  onReorderRef.current = onReorder;

  const indexFromY = (y: number): number => {
    const last = itemsRef.current.length - 1;
    if (last < 0) return 0;
    for (let i = 0; i <= last; i += 1) {
      const row = rowRefs.current[i];
      if (!row) continue;
      const rect = row.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) return i;
    }
    return last;
  };

  const startDrag = (
    index: number,
    event: React.PointerEvent<HTMLElement>,
  ) => {
    if (disabled) return;
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.stopPropagation();

    const from = index;
    let over = index;
    let didMove = false;
    let scrollLocked = false;
    const originY = event.clientY;
    let previousOverflow = '';
    let previousTouchAction = '';

    const lockScroll = () => {
      if (scrollLocked) return;
      scrollLocked = true;
      previousOverflow = document.body.style.overflow;
      previousTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    };

    const unlockScroll = () => {
      if (!scrollLocked) return;
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      scrollLocked = false;
    };

    setActiveIndex(from);
    setOverIndex(from);

    const onMove = (moveEvent: PointerEvent) => {
      if (!didMove) {
        if (Math.abs(moveEvent.clientY - originY) < DRAG_THRESHOLD_PX) return;
        didMove = true;
        lockScroll();
      }
      moveEvent.preventDefault();
      over = indexFromY(moveEvent.clientY);
      setOverIndex(over);
    };

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (!didMove) return;
      moveEvent.preventDefault();
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      unlockScroll();
      setActiveIndex(null);
      setOverIndex(null);
      if (didMove && from !== over) onReorderRef.current(from, over);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  return (
    <>
      {items.map((name, index) => (
        <li
          key={name}
          ref={(node) => {
            rowRefs.current[index] = node;
          }}
          className={cn(
            'flex gap-1',
            variant === 'card'
              ? 'items-start rounded-xl border border-border bg-card p-3'
              : 'items-center px-1 py-2 text-sm',
            activeIndex === index && 'bg-primary/15',
            overIndex === index &&
              activeIndex != null &&
              activeIndex !== index &&
              'border-primary border-t-2',
          )}
        >
          <button
            type="button"
            aria-label={`Drag ${name} to reorder`}
            disabled={disabled}
            className="text-primary flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md border border-primary/50 bg-primary/15 active:cursor-grabbing disabled:opacity-30"
            onPointerDown={(event) => startDrag(index, event)}
          >
            <GripVertical className="size-5" />
          </button>
          {renderItem(name, index)}
        </li>
      ))}
    </>
  );
}
