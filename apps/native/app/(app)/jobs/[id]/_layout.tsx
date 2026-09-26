import { Stack } from 'expo-router';

import { colors } from '@/src/theme';
import { BackLabelButton } from '@/src/ui/back-label';

export default function JobLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '600', fontSize: 16, color: colors.text },
        contentStyle: { backgroundColor: colors.background },
        headerTitleAlign: 'left',
        headerBackVisible: false,
        headerLeft: () => <BackLabelButton label="Back" />,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="history" />
      <Stack.Screen name="keys" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="routine" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="ingoing" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="outgoing" options={{ headerShown: false, animation: 'none' }} />
      <Stack.Screen name="open" options={{ headerShown: false, animation: 'none' }} />
    </Stack>
  );
}
