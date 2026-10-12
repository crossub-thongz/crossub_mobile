import * as React from 'react';

import { bindTextValueWithoutEmojis, propAllowsEmoji, stripEmojis } from '@/lib/strip-emojis';
import { cn } from '@/lib/utils';

function Input({
  className,
  type,
  onChange,
  value,
  defaultValue,
  'data-allow-emoji': allowEmojiProp,
  ...props
}: React.ComponentProps<'input'> & { 'data-allow-emoji'?: string | boolean }) {
  const isDateInput =
    type === 'date' || type === 'datetime-local' || type === 'time';
  const allowEmoji = propAllowsEmoji(allowEmojiProp);
  const textValue = typeof value === 'string' && !allowEmoji ? stripEmojis(value) : value;
  const textDefault =
    typeof defaultValue === 'string' && !allowEmoji ? stripEmojis(defaultValue) : defaultValue;

  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        isDateInput &&
          'date-input [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert',
        className,
      )}
      {...props}
      value={textValue}
      defaultValue={textDefault}
      onChange={allowEmoji ? onChange : bindTextValueWithoutEmojis(onChange)}
    />
  );
}

export { Input };
