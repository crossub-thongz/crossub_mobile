import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppTextInput } from '@/src/ui/app-text-input';

import { changePassword } from '@/src/api/client';
import { useAuth } from '@/src/auth/auth-context';
import { PASSWORD_MIN } from '@/src/constants/auth';
import { profilePath, settingsPath } from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { user, refreshUser } = useAuth();
  const forced = Boolean(user?.mustChangePassword);
  const skipCurrent = Boolean(user?.mustChangePasswordWithoutCurrent);
  const backHref = params.from === 'profile' ? profilePath : settingsPath;
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!skipCurrent && !currentPassword) {
      setError('Enter your current password');
      return;
    }
    if (newPassword.length < PASSWORD_MIN) {
      setError(`Min ${PASSWORD_MIN} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!skipCurrent && currentPassword === newPassword) {
      setError('New password must be different from the current password');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await changePassword({
        ...(skipCurrent ? {} : { currentPassword }),
        newPassword,
      });
      await refreshUser();
      Alert.alert(
        'Password updated',
        forced ? 'Welcome to the Inspector app.' : 'Your password has been changed.',
      );
      router.replace(forced ? '/' : backHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.safe}>
      <AppHeader
        title={skipCurrent ? 'Choose your password' : 'Change password'}
        backHref={forced ? undefined : backHref}
      />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.body}>
          {skipCurrent
            ? 'Choose a password for your Inspector app account to continue.'
            : forced
              ? 'Your account was set up with a temporary password. Enter it below, then choose a new password.'
              : 'Enter your current password, then choose a new one.'}
        </Text>
        {!skipCurrent ? (
          <>
            <Text style={styles.label}>Existing password</Text>
            <AppTextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry={!show.current}
              autoComplete="password"
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor={colors.muted}
            />
            <Pressable onPress={() => setShow((s) => ({ ...s, current: !s.current }))}>
              <Text style={styles.toggle}>{show.current ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </>
        ) : null}
        <Text style={styles.label}>New password</Text>
        <AppTextInput
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!show.next}
          autoComplete="password-new"
          style={styles.input}
          placeholder={`At least ${PASSWORD_MIN} characters`}
          placeholderTextColor={colors.muted}
        />
        <Pressable onPress={() => setShow((s) => ({ ...s, next: !s.next }))}>
          <Text style={styles.toggle}>{show.next ? 'Hide' : 'Show'}</Text>
        </Pressable>
        <Text style={styles.label}>Confirm new password</Text>
        <AppTextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!show.confirm}
          autoComplete="password-new"
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor={colors.muted}
        />
        <Pressable onPress={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}>
          <Text style={styles.toggle}>{show.confirm ? 'Hide' : 'Show'}</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable disabled={busy} onPress={() => void onSubmit()} style={[styles.cta, busy && styles.ctaOff]}>
          <Text style={styles.ctaText}>
            {busy ? 'Saving…' : forced ? 'Save and continue' : 'Update password'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 8 },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 8 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.text,
  },
  toggle: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  error: { color: colors.destructive, fontSize: 12 },
  cta: {
    marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaOff: { opacity: 0.5 },
  ctaText: { color: colors.primaryFg, fontWeight: '700' },
});
