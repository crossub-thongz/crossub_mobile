import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/auth/auth-context';

export default function LoginWithTokenScreen() {
  const { loginWithMagicLink } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token)?.trim() ?? '';
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    void (async () => {
      try {
        await loginWithMagicLink(token);
        router.replace('/');
      } catch (err) {
        setFailed(true);
        setError(
          err instanceof Error
            ? err.message
            : 'Could not sign you in. Request a new link from the office.',
        );
      }
    })();
  }, [token, loginWithMagicLink, router]);

  if (!token || failed) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>
          <Text style={styles.title}>Sign-in link expired</Text>
          <Text style={styles.sub}>
            {error ??
              'Ask the office to email you another Inspector app link, or sign in with your password if you already have one.'}
          </Text>
          <Link href="/login" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>Back to sign in</Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>
        <Text style={styles.kicker}>CROSSUB</Text>
        <Text style={styles.title}>Inspector</Text>
        <Text style={styles.sub}>Signing you in...</Text>
        <ActivityIndicator color="#00d4a4" style={styles.spinner} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0f10' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 64 },
  kicker: {
    color: '#00d4a4',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '700', marginTop: 4 },
  sub: { color: '#6b7280', fontSize: 15, marginTop: 8, lineHeight: 22 },
  spinner: { marginTop: 32 },
  button: {
    marginTop: 24,
    backgroundColor: '#00d4a4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#0b0f10', fontSize: 16, fontWeight: '700' },
});
