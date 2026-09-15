import { Link } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/src/auth/auth-context';
import { normalizeAuthEmail } from '@/src/auth/types';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/src/constants/auth';
import { getApiOrigin } from '@/src/config/api-url';

export default function SignupScreen() {
  const { register, status } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!firstName.trim()) {
      setError('First name is required');
      return;
    }
    if (!lastName.trim()) {
      setError('Last name is required');
      return;
    }
    const normalized = normalizeAuthEmail(email);
    if (!normalized.includes('@')) {
      setError('Enter a valid email');
      return;
    }
    if (password.length < PASSWORD_MIN) {
      setError(`Min ${PASSWORD_MIN} characters`);
      return;
    }
    if (password.length > PASSWORD_MAX) {
      setError('Password is too long');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register({
        email: normalized,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.');
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
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <Text style={styles.kicker}>CROSSUB</Text>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.sub}>
            Use the email Operations invited, or the one already on your inspector registration
          </Text>

          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.label}>First name</Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                autoComplete="given-name"
                placeholderTextColor="#6f6f6f"
                style={styles.input}
              />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Last name</Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                autoComplete="family-name"
                placeholderTextColor="#6f6f6f"
                style={styles.input}
              />
            </View>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            placeholderTextColor="#6f6f6f"
            style={styles.input}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              placeholderTextColor="#6f6f6f"
              style={[styles.input, styles.passwordInput]}
            />
            <Pressable onPress={() => setShowPassword((value) => !value)} style={styles.eye}>
              <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            autoComplete="new-password"
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
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </Pressable>

          <Text style={styles.meta}>
            Already have an account?{' '}
            <Link href="/login" style={styles.link}>
              Sign in
            </Link>
          </Text>
          <Text style={styles.hint}>Nest {getApiOrigin()} · POST /api/auth/register-inspector</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#0b0f10' },
  inner: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 40 },
  kicker: {
    color: '#00d4a4',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  title: { color: '#ffffff', fontSize: 32, fontWeight: '700', marginTop: 4 },
  sub: { color: '#6b7280', fontSize: 15, marginTop: 8, marginBottom: 24, lineHeight: 22 },
  row: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
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
  meta: { color: '#6b7280', fontSize: 14, marginTop: 24, textAlign: 'center' },
  link: { color: '#00d4a4', fontWeight: '600' },
  hint: { color: '#6b7280', fontSize: 12, marginTop: 16, lineHeight: 18 },
});
