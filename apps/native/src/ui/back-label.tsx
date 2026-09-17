import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/src/theme';

export const BACK_LABEL = '< Back';

export function BackLabelButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={styles.hit}
    >
      <Text style={styles.text}>{BACK_LABEL}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { paddingVertical: 8, paddingRight: 12 },
  text: { color: colors.primary, fontSize: 14, fontWeight: '500' },
});
