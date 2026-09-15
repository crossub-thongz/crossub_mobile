import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { requestPasswordReset } from '@/src/api/client';
import { normalizeAuthEmail } from '@/src/auth/types';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async () => {
    const normalized = normalizeAuthEmail(email);
    if (!normalized.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(normalized);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.kicker}>CROSSUB</Text>
          <Text style={styles.title}>Reset password</Text>

          {sent ? (
            <>
              <Text style={styles.sub}>Check your email for a password reset link.</Text>
              <Link href="/login" asChild>
                <Pressable style={styles.outline}>
                  <Text style={styles.outlineText}>Back to sign in</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@email.com"
                placeholderTextColor="#6f6f6f"
                style={styles.input}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={() => {
                  void onSubmit();
                }}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  submitting && styles.buttonDisabled,
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#111111" />
                ) : (
                  <Text style={styles.buttonText}>Send reset link</Text>
                )}
              </Pressable>
              <Link href="/login" style={styles.link}>
                Back to sign in
              </Link>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#0b0f10' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
  kicker: {
    color: '#00d4a4',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: { color: '#ffffff', fontSize: 32, fontWeight: '700', marginTop: 4, marginBottom: 12 },
  sub: { color: '#6b7280', fontSize: 15, lineHeight: 22, marginBottom: 24 },
  label: { color: '#6b7280', fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#1c2326',
    backgroundColor: '#111617',
    color: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: '#ef4444', marginTop: 12, fontSize: 14 },
  button: {
    marginTop: 24,
    backgroundColor: '#00d4a4',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#0b0f10', fontSize: 16, fontWeight: '700' },
  outline: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1c2326',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  outlineText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  link: { color: '#00d4a4', fontSize: 14, textAlign: 'center', marginTop: 20 },
});
