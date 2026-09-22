import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/auth/auth-context';
import { normalizeAuthEmail, PASSWORD_MAX } from '@/src/auth/types';
import { getApiOrigin } from '@/src/config/api-url';

export default function LoginScreen() {
  const { login, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const origin = getApiOrigin();

  const onSubmit = async () => {
    const normalized = normalizeAuthEmail(email);
    if (!normalized.includes('@')) {
      setError('Enter a valid email.');
      return;
    }
    if (!password || password.length > PASSWORD_MAX) {
      setError('Enter your password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(normalized, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'authed') {
    return (
      <View style={styles.safe}>
        <ActivityIndicator color="#00d4a4" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.kicker}>CROSSUB</Text>
          <Text style={styles.title}>Inspector</Text>
          <Text style={styles.sub}>Sign in with your inspector account</Text>

          <Text style={styles.label}>Email</Text>
          <AppTextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@crossub.com.au"
            placeholderTextColor="#6f6f6f"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <AppTextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              placeholder="Password"
              placeholderTextColor="#6f6f6f"
              style={[styles.input, styles.passwordInput]}
              onSubmitEditing={onSubmit}
            />
            <Pressable
              onPress={() => setShowPassword((value) => !value)}
              style={styles.eye}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            >
              <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.links}>
            <Link href="/signup" style={styles.link}>
              Create account
            </Link>
            <Link href="/forgot-password" style={styles.link}>
              Forgot password?
            </Link>
          </View>

          <Pressable
            onPress={onSubmit}
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
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>

          <Text style={styles.meta}>
            Nest {origin} · POST /api/v1/auth/login · Bearer tokens in SecureStore
          </Text>
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
  title: { color: '#ffffff', fontSize: 36, fontWeight: '700', marginTop: 4 },
  sub: { color: '#6b7280', fontSize: 16, marginTop: 8, marginBottom: 28 },
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
  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 64 },
  eye: { position: 'absolute', right: 12, top: 12 },
  eyeText: { color: '#00d4a4', fontSize: 13, fontWeight: '600' },
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
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  link: { color: '#00d4a4', fontSize: 14 },
  meta: { color: '#6b7280', fontSize: 12, marginTop: 28, lineHeight: 18 },
});
