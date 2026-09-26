import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppTextInput } from '@/src/ui/app-text-input';
import { useRouter } from 'expo-router';

import { useAccount } from '@/src/account/account-context';
import { useAuth } from '@/src/auth/auth-context';
import { INSPECTOR_HOURLY_RATE_AUD } from '@/src/constants/inspection';
import {
  INSPECTOR_LICENCE_TYPES,
  INSPECTOR_SERVICE_REGIONS,
} from '@/src/constants/inspector-registration';
import { displayName } from '@/src/lib/datetime';
import { profilePath } from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { DateField } from '@/src/ui/date-field';

export default function RegisterScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { registration, draft, registrationComplete, registrationResolved, saveRegistration } =
    useAccount();
  const rosterOnlyComplete = registrationComplete && !registration;
  const [mobile, setMobile] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [residentialAddress, setResidentialAddress] = useState('');
  const [abn, setAbn] = useState('');
  const [licenceType, setLicenceType] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [licenceExpiry, setLicenceExpiry] = useState('');
  const [serviceRegions, setServiceRegions] = useState<string[]>([]);
  const [tribunalQualified, setTribunalQualified] = useState(false);
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankBsb, setBankBsb] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!registrationResolved || !rosterOnlyComplete) return;
    router.replace('/');
  }, [registrationResolved, rosterOnlyComplete, router]);

  useEffect(() => {
    setMobile(draft?.mobile ?? registration?.mobile ?? '');
    setDateOfBirth(draft?.dateOfBirth ?? '');
    setResidentialAddress(draft?.residentialAddress ?? '');
    setAbn(draft?.abn ?? registration?.abn ?? '');
    setLicenceType(draft?.licenceType ?? registration?.licenceType ?? '');
    setLicenceNumber(draft?.licenceNumber ?? registration?.licenceNumber ?? '');
    setLicenceExpiry(
      (draft?.licenceExpiry ?? registration?.licenceExpiry ?? '').slice(0, 10),
    );
    setServiceRegions(draft?.serviceRegions ?? registration?.serviceRegions ?? []);
    setTribunalQualified(
      Boolean(draft?.tribunalQualified ?? registration?.tribunalQualified),
    );
    setBankAccountName(
      draft?.bankAccountName ??
        (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : ''),
    );
    setBankBsb(draft?.bankBsb ?? '');
    setBankAccountNumber(draft?.bankAccountNumber ?? '');
  }, [draft, registration, user?.firstName, user?.lastName]);

  const toggleRegion = (region: string) => {
    setServiceRegions((current) =>
      current.includes(region) ? current.filter((item) => item !== region) : [...current, region],
    );
  };

  const onSubmit = async () => {
    if (!user?.email) {
      Alert.alert('Sign in again', 'Account details missing.');
      return;
    }
    if (mobile.trim().length < 8) {
      setFormError('Mobile required');
      return;
    }
    if (!dateOfBirth.trim()) {
      setFormError('Date of birth required');
      return;
    }
    if (residentialAddress.trim().length < 5) {
      setFormError('Address required');
      return;
    }
    if (!licenceType) {
      setFormError('Select licence type');
      return;
    }
    if (serviceRegions.length === 0) {
      setFormError('Select at least one region');
      return;
    }
    if (bankAccountName.trim().length < 2) {
      setFormError('Account name required');
      return;
    }
    if (bankBsb.trim().length < 6) {
      setFormError('BSB required');
      return;
    }
    if (bankAccountNumber.trim().length < 6) {
      setFormError('Account number required');
      return;
    }
    setFormError(null);
    setBusy(true);
    try {
      await saveRegistration({
        firstName: user.firstName?.trim() || 'Inspector',
        lastName: user.lastName?.trim() || 'User',
        mobile: mobile.trim(),
        dateOfBirth: dateOfBirth.trim(),
        residentialAddress: residentialAddress.trim(),
        abn: abn.trim() || undefined,
        licenceType,
        licenceNumber: licenceNumber.trim() || undefined,
        licenceExpiry: licenceExpiry.trim() || undefined,
        serviceRegions,
        tribunalQualified,
        bankAccountName: bankAccountName.trim(),
        bankBsb: bankBsb.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
      });
      Alert.alert('Profile saved', 'Your application is with Inspection Dept for review.');
      await refreshUser();
      router.replace('/');
    } catch (err) {
      Alert.alert(
        'Could not save',
        err instanceof Error ? err.message : 'Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (rosterOnlyComplete) return null;

  return (
    <View style={styles.safe}>
      <AppHeader title="Inspector profile" backHref={profilePath} />
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.lede}>
          Complete your professional details. Your sign-in info is already on file.
        </Text>
        <View style={styles.account}>
          <Text style={styles.name}>{user ? displayName(user) : 'Your account'}</Text>
          <Text style={styles.meta}>{user?.email}</Text>
        </View>
        <Text style={styles.pay}>
          Pay: ${INSPECTOR_HOURLY_RATE_AUD}/hour on-site. Inspection duration set by property type.
        </Text>

        <Text style={styles.section}>Contact details</Text>
        <Text style={styles.label}>Mobile</Text>
        <AppTextInput
          value={mobile}
          onChangeText={setMobile}
          keyboardType="phone-pad"
          style={styles.input}
          placeholder="04xx xxx xxx"
          placeholderTextColor={colors.muted}
        />
        <Text style={styles.label}>Date of birth</Text>
        <DateField
          value={dateOfBirth}
          onChange={setDateOfBirth}
          placeholder="Select date of birth"
          maximumDate={new Date()}
        />
        <Text style={styles.label}>Residential address</Text>
        <AppTextInput
          value={residentialAddress}
          onChangeText={setResidentialAddress}
          style={styles.input}
          placeholder="Street, suburb"
          placeholderTextColor={colors.muted}
        />
        <Text style={styles.label}>ABN (optional)</Text>
        <AppTextInput
          value={abn}
          onChangeText={setAbn}
          style={styles.input}
          placeholder="12 345 678 901"
          placeholderTextColor={colors.muted}
        />

        <Text style={styles.section}>Licence</Text>
        {INSPECTOR_LICENCE_TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => setLicenceType(type)}
            style={[styles.option, licenceType === type && styles.optionOn]}
          >
            <Text style={[styles.optionText, licenceType === type && styles.optionTextOn]}>
              {type}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.label}>Licence number (optional)</Text>
        <AppTextInput
          value={licenceNumber}
          onChangeText={setLicenceNumber}
          style={styles.input}
          placeholderTextColor={colors.muted}
        />
        <Text style={styles.label}>Licence expiry (optional)</Text>
        <DateField
          value={licenceExpiry}
          onChange={setLicenceExpiry}
          placeholder="Select expiry date"
          optional
        />

        <Text style={styles.section}>Service areas</Text>
        <View style={styles.chips}>
          {INSPECTOR_SERVICE_REGIONS.map((region) => {
            const active = serviceRegions.includes(region);
            return (
              <Pressable
                key={region}
                onPress={() => toggleRegion(region)}
                style={[styles.chip, active && styles.chipOn]}
              >
                <Text style={[styles.chipText, active && styles.chipTextOn]}>{region}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Access level</Text>
        <Text style={styles.meta}>
          New inspectors start at Level 1 (Final, Entry). CROSSUB staff set your level
          from the admin portal after review ? it cannot be changed here.
        </Text>
        <Pressable
          onPress={() => setTribunalQualified((value) => !value)}
          style={styles.checkRow}
        >
          <View style={[styles.check, tribunalQualified && styles.checkOn]} />
          <Text style={styles.body}>I am qualified to accept tribunal assignments</Text>
        </Pressable>

        <Text style={styles.section}>Bank details (payroll)</Text>
        <Text style={styles.label}>Account name</Text>
        <AppTextInput
          value={bankAccountName}
          onChangeText={setBankAccountName}
          style={styles.input}
          placeholderTextColor={colors.muted}
        />
        <Text style={styles.label}>BSB</Text>
        <AppTextInput
          value={bankBsb}
          onChangeText={setBankBsb}
          style={styles.input}
          placeholder="062-000"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
        />
        <Text style={styles.label}>Account number</Text>
        <AppTextInput
          value={bankAccountNumber}
          onChangeText={setBankAccountNumber}
          style={styles.input}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          secureTextEntry
        />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        <Pressable disabled={busy} onPress={() => void onSubmit()} style={[styles.cta, busy && styles.ctaOff]}>
          <Text style={styles.ctaText}>{busy ? 'Saving?' : 'Save profile & continue'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 48, gap: 8 },
  lede: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  account: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
  },
  name: { color: colors.text, fontSize: 16, fontWeight: '600' },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  body: { color: colors.text, fontSize: 13, flex: 1 },
  pay: {
    color: colors.primary,
    fontSize: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,212,164,0.3)',
    backgroundColor: 'rgba(0,212,164,0.08)',
    borderRadius: 10,
    padding: 10,
  },
  section: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 10 },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: colors.text,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: 'rgba(0,212,164,0.1)' },
  optionText: { color: colors.muted, fontSize: 13 },
  optionTextOn: { color: colors.primary, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: 'rgba(0,212,164,0.12)' },
  chipText: { color: colors.muted, fontSize: 12 },
  chipTextOn: { color: colors.primary, fontWeight: '600' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  check: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  error: { color: colors.destructive, fontSize: 12 },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaOff: { opacity: 0.5 },
  ctaText: { color: colors.primaryFg, fontWeight: '700' },
});
