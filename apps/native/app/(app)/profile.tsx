import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAccount } from '@/src/account/account-context';
import { useAuth } from '@/src/auth/auth-context';
import { INSPECTOR_HOURLY_RATE_AUD } from '@/src/constants/inspection';
import {
  REGISTRATION_STATUS_LABEL,
  type RegistrationStatusKey,
} from '@/src/constants/inspector-registration';
import { displayName, formatDate } from '@/src/lib/datetime';
import {
  changePasswordPath,
  registerPath,
  weeklyAvailabilityPath,
} from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function statusLabel(status?: string | null): string | undefined {
  if (!status) return undefined;
  if (status in REGISTRATION_STATUS_LABEL) {
    return REGISTRATION_STATUS_LABEL[status as RegistrationStatusKey];
  }
  return status;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, registration, draft, accessLevel, tribunalQualified, registrationComplete, loading } =
    useAccount();
  const name = user ? displayName(user) : displayName(profile ?? {});
  const needsRegistration = !registrationComplete;

  return (
    <View style={styles.safe}>
      <AppHeader title="Inspector Information" backHref="/more" />
      <ScrollView contentContainerStyle={styles.inner}>
        {loading && !profile ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : needsRegistration ? (
          <View style={styles.card}>
            <Text style={styles.body}>Registration not completed.</Text>
            <Pressable onPress={() => router.push(registerPath)} style={styles.cta}>
              <Text style={styles.ctaText}>Complete registration</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="person-outline" size={16} color={colors.primary} />
                <Text style={styles.cardTitle}>Personal</Text>
              </View>
              <Text style={styles.name}>{name}</Text>
              <InfoRow
                label="Status"
                value={statusLabel(registration?.registrationStatus) ?? REGISTRATION_STATUS_LABEL.approved}
              />
              <InfoRow label="Email" value={registration?.email ?? profile?.email ?? user?.email} />
              <InfoRow label="Mobile" value={registration?.mobile ?? profile?.phone ?? draft?.mobile} />
              <InfoRow
                label="DOB"
                value={draft?.dateOfBirth ? formatDate(draft.dateOfBirth) : undefined}
              />
              <InfoRow label="Address" value={draft?.residentialAddress} />
              <InfoRow label="ABN" value={registration?.abn ?? draft?.abn} />
              <InfoRow label="Access level" value={`Level ${accessLevel}`} />
            </View>

            {registration ? (
              <>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <Ionicons name="shield-outline" size={16} color={colors.primary} />
                    <Text style={styles.cardTitle}>Licence</Text>
                  </View>
                  <InfoRow label="Licence type" value={registration.licenceType} />
                  <InfoRow label="Licence no." value={registration.licenceNumber} />
                  <InfoRow
                    label="Licence expiry"
                    value={registration.licenceExpiry ? formatDate(registration.licenceExpiry) : undefined}
                  />
                </View>
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <Ionicons name="location-outline" size={16} color={colors.primary} />
                    <Text style={styles.cardTitle}>Service regions</Text>
                  </View>
                  <View style={styles.chips}>
                    {registration.serviceRegions.map((region) => (
                      <View key={region} style={styles.chip}>
                        <Text style={styles.chipText}>{region}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.meta}>
                    {tribunalQualified
                      ? 'Tribunal qualified'
                      : 'Not marked as tribunal qualified'}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Ionicons name="shield-outline" size={16} color={colors.primary} />
                  <Text style={styles.cardTitle}>Access</Text>
                </View>
                <Text style={styles.meta}>
                  {tribunalQualified
                    ? 'Tribunal qualified'
                    : 'Not marked as tribunal qualified'}
                </Text>
              </View>
            )}

            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.cardTitle}>Time Availability</Text>
              </View>
              <Text style={styles.body}>Select the days and hours you can take inspection jobs.</Text>
              <Pressable
                onPress={() => router.push(weeklyAvailabilityPath)}
                style={styles.outline}
              >
                <Text style={styles.outlineText}>Set available times</Text>
              </Pressable>
            </View>

            {registration ? (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Ionicons name="card-outline" size={16} color={colors.primary} />
                  <Text style={styles.cardTitle}>Payroll (Accounting)</Text>
                </View>
                <InfoRow label="Account name" value={draft?.bankAccountName} />
                <InfoRow label="BSB" value={draft?.bankBsb} />
                <InfoRow
                  label="Account"
                  value={
                    draft?.bankAccountNumber
                      ? `••••${draft.bankAccountNumber.slice(-4)}`
                      : registration.bankAccountLast4
                        ? `••••${registration.bankAccountLast4}`
                        : undefined
                  }
                />
                <InfoRow label="Labour rate" value={`$${INSPECTOR_HOURLY_RATE_AUD}/hour`} />
              </View>
            ) : null}

            {registration?.submittedAt ? (
              <Text style={styles.meta}>
                Submitted {formatDate(registration.submittedAt)}
                {registration.reviewedAt ? ` · Reviewed ${formatDate(registration.reviewedAt)}` : ''}
              </Text>
            ) : null}
          </>
        )}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.primary} />
            <Text style={styles.cardTitle}>Password</Text>
          </View>
          <Text style={styles.body}>Change the password you use to sign in to the Inspector app.</Text>
          <Pressable onPress={() => router.push(changePasswordPath)} style={styles.outline}>
            <Text style={styles.outlineText}>Change password</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push(registerPath)} style={styles.outline}>
          <Text style={styles.outlineText}>
            {needsRegistration ? 'Start registration' : registration ? 'Update registration' : 'View registration'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 12 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  name: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.muted, fontSize: 11 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '500', flex: 1, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(0,212,164,0.3)',
    backgroundColor: 'rgba(0,212,164,0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { color: colors.primary, fontSize: 10, fontWeight: '600' },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: { color: colors.primaryFg, fontWeight: '700' },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineText: { color: colors.text, fontWeight: '600' },
});
