import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  acceptSystemAccessAgreement,
  fetchSystemAccessAgreement,
} from '@/src/api/client';
import { useAccount } from '@/src/account/account-context';
import { useAuth } from '@/src/auth/auth-context';
import { shareSystemAccessAgreementDocument } from '@/src/lib/saa-document';
import {
  needsSystemAccessAgreement,
  type SystemAccessAgreementView,
} from '@/src/lib/system-access-agreement';
import { registerPath } from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

export default function SystemAccessAgreementScreen() {
  const router = useRouter();
  const { user, status, refreshUser } = useAuth();
  const { registrationComplete, registrationResolved, loading: accountLoading } = useAccount();
  const [agreement, setAgreement] = useState<SystemAccessAgreementView | null>(null);
  const [signerName, setSignerName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status !== 'authed' || !user || accountLoading || !registrationResolved) return;
    if (!registrationComplete) {
      router.replace(registerPath);
      return;
    }
    if (!needsSystemAccessAgreement(user)) {
      router.replace('/');
      return;
    }

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (fullName) setSignerName(fullName);

    let active = true;
    void (async () => {
      try {
        const data = await fetchSystemAccessAgreement();
        if (active) setAgreement(data);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Unable to load the system access agreement.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [status, user, registrationComplete, registrationResolved, accountLoading, router]);

  const onAccept = async () => {
    if (!signerName.trim()) {
      setError('Enter your full legal name.');
      return;
    }
    if (!agreed) {
      setError('You must confirm that you have read and agree to the agreement.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await acceptSystemAccessAgreement(signerName.trim());
      await refreshUser();
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record your agreement.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || accountLoading || !registrationResolved || loading) {
    return (
      <View style={styles.safe}>
        <AppHeader title="Inspector Portal Access Agreement" />
        <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <AppHeader title="Inspector Portal Access Agreement" />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Required before access</Text>
        <Text style={styles.body}>
          Before using the CROSSUB Inspector portal, you must read and accept the inspector
          portal access, confidentiality, privacy and field services compliance agreement. Your
          signed acceptance will be stored in HR.
        </Text>

        {agreement ? (
          <View style={styles.doc}>
            <Text style={styles.docTitle}>{agreement.title}</Text>
            <Text style={styles.meta}>
              Version {agreement.version} ? {agreement.fileName}
            </Text>
            <Pressable
              onPress={() => {
                void shareSystemAccessAgreementDocument({
                  fileName: agreement.fileName,
                  documentPath: agreement.documentPath,
                }).catch((err) =>
                  Alert.alert(
                    'Agreement document',
                    err instanceof Error ? err.message : 'Could not open the agreement document.',
                  ),
                );
              }}
            >
              <Text style={styles.docLink}>Open agreement document</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.label}>Full legal name</Text>
        <TextInput
          value={signerName}
          onChangeText={setSignerName}
          placeholder="As it appears on your inspector licence"
          placeholderTextColor={colors.muted}
          autoComplete="name"
          style={styles.input}
        />

        <Pressable onPress={() => setAgreed((value) => !value)} style={styles.checkRow}>
          <View style={[styles.box, agreed && styles.boxOn]}>
            {agreed ? <Text style={styles.check}>?</Text> : null}
          </View>
          <Text style={styles.checkLabel}>
            I have read the inspector portal access agreement and agree to be bound by its
            confidentiality, privacy and field services compliance obligations.
          </Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={() => {
            void onAccept();
          }}
          disabled={submitting}
          style={[styles.button, submitting && styles.disabled]}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryFg} />
          ) : (
            <Text style={styles.buttonText}>Accept and continue</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40 },
  kicker: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  body: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  doc: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  docTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 6 },
  docLink: { color: colors.primary, fontSize: 14, fontWeight: '700', marginTop: 12 },
  label: { color: colors.muted, fontSize: 13, marginTop: 20, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  check: { color: colors.primaryFg, fontSize: 12, fontWeight: '700' },
  checkLabel: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
  error: { color: colors.destructive, marginTop: 16, fontSize: 14 },
  button: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: colors.primaryFg, fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
