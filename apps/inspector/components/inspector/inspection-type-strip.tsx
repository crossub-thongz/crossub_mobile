'use client';

import {
  INSPECTION_PAY_LABEL,
  type CoreInspectionType,
} from '@/constants/inspection';
import { cn } from '@/lib/utils';

/** Tab order on the Crossub Inspection list (matches field-app layout). */
export const INSPECTION_LIST_TAB_ORDER: CoreInspectionType[] = [
  'routine',
  'ingoing',
  'outgoing',
  'open',
];

export function InspectionTypeStrip({
  active,
  onChange,
  types = INSPECTION_LIST_TAB_ORDER,
}: {
  active: CoreInspectionType;
  onChange: (type: CoreInspectionType) => void;
  types?: readonly CoreInspectionType[];
}) {
  return (
    <div className="border-border flex border-b">
      {types.map((type) => {
        const selected = active === type;
        const label = INSPECTION_PAY_LABEL[type] ?? type;

        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={cn(
              'relative flex-1 py-2.5 text-center text-sm font-medium transition',
              selected ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {selected && (
              <span className="bg-primary absolute right-3 bottom-0 left-3 h-0.5 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
