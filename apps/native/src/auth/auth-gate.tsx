import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/src/auth/auth-context';

export function AuthGate() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    const onMagicLink = inAuthGroup && segments[1] === 'login' && segments.length > 2;
    if (status !== 'authed' && !inAuthGroup) {
      router.replace('/login');
    } else if (status === 'authed' && inAuthGroup && !onMagicLink) {
      router.replace('/');
    }
  }, [status, segments, router]);

  return (
    <View style={styles.root}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0b0f10' },
        }}
      />
      <StatusBar style="light" />
      {status === 'loading' ? (
        <View style={styles.boot}>
          <ActivityIndicator color="#00d4a4" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f10' },
  boot: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0b0f10',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
