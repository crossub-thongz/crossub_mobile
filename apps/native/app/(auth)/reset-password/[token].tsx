import { Link, useLocalSearchParams, useRouter } from 'expo-router';
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

import { resetPasswordWithToken } from '@/src/api/client';
import { PASSWORD_MAX, PASSWORD_MIN } from '@/src/constants/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = (Array.isArray(params.token) ? params.token[0] : params.token)?.trim() ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!token) {
      setError('This reset link is invalid.');
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setError(`Min ${PASSWORD_MIN} characters`);
      return;
    }
    if (newPassword.length > PASSWORD_MAX) {
      setError('Password is too long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await resetPasswordWithToken(token, newPassword);
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.inner}>
          <Text style={styles.title}>Invalid reset link</Text>
          <Text style={styles.sub}>Request a new password reset email to continue.</Text>
          <Link href="/forgot-password" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>Request reset link</Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Link href="/login" style={styles.back}>
            Back to sign in
          </Link>
          <Text style={styles.title}>Choose a new password</Text>
          <Text style={styles.sub}>Enter a new password for your Inspector app account.</Text>

          <Text style={styles.label}>New password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              autoComplete="new-password"
              placeholder="Enter your new password"
              placeholderTextColor="#6f6f6f"
              style={[styles.input, styles.passwordInput]}
            />
            <Pressable onPress={() => setShowNew((value) => !value)} style={styles.eye}>
              <Text style={styles.eyeText}>{showNew ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          <Text style={styles.hint}>At least {PASSWORD_MIN} characters.</Text>

          <Text style={styles.label}>Confirm password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              autoComplete="new-password"
              placeholder="Confirm your new password"
              placeholderTextColor="#6f6f6f"
              style={[styles.input, styles.passwordInput]}
            />
            <Pressable onPress={() => setShowConfirm((value) => !value)} style={styles.eye}>
              <Text style={styles.eyeText}>{showConfirm ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

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
              <Text style={styles.buttonText}>Reset password</Text>
            )}
          </Pressable>

          <Text style={styles.meta}>
            Link expired?{' '}
            <Link href="/forgot-password" style={styles.link}>
              Request another
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: '#0b0f10' },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  back: { color: '#6b7280', fontSize: 14, marginBottom: 20 },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '700' },
  sub: { color: '#6b7280', fontSize: 15, marginTop: 8, marginBottom: 16, lineHeight: 22 },
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
  hint: { color: '#6b7280', fontSize: 11, marginTop: 6 },
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
  meta: { color: '#6b7280', fontSize: 12, marginTop: 20, textAlign: 'center' },
  link: { color: '#00d4a4' },
});
