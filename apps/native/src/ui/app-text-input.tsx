import { forwardRef } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { stripEmojis } from '@/src/lib/strip-emojis';

export type AppTextInputProps = TextInputProps & {
  allowEmoji?: boolean;
};

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(function AppTextInput(
  { allowEmoji = false, onChangeText, value, defaultValue, ...props },
  ref,
) {
  return (
    <TextInput
      ref={ref}
      {...props}
      value={typeof value === 'string' && !allowEmoji ? stripEmojis(value) : value}
      defaultValue={
        typeof defaultValue === 'string' && !allowEmoji ? stripEmojis(defaultValue) : defaultValue
      }
      onChangeText={
        onChangeText ? (text) => onChangeText(allowEmoji ? text : stripEmojis(text)) : undefined
      }
    />
  );
});
