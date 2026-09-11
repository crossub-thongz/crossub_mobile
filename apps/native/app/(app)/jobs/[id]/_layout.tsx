import { Stack } from 'expo-router';

import { colors } from '@/src/theme';

export default function JobLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600', fontSize: 16 },
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
