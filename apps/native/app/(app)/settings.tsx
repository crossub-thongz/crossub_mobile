import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { WeeklyTimetableCard } from '@/src/account/weekly-timetable-card';
import { changePasswordPath } from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.safe}>
      <AppHeader title="Settings" backHref="/more" />
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.card}>
          <Text style={styles.title}>Account security</Text>
          <Text style={styles.body}>
            Change the password you use to sign in to the Inspector app.
          </Text>
          <Pressable onPress={() => router.push(changePasswordPath)} style={styles.outline}>
            <Text style={styles.outlineText}>Change password</Text>
          </Pressable>
        </View>

        <WeeklyTimetableCard />

        <View style={styles.card}>
          <Text style={styles.title}>Offline Mode</Text>
          <Text style={styles.body}>
            Field work currently needs a connection. Drafts and photo blobs are not queued
            on the phone yet — stay online to save findings and evidence.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Connected Apps</Text>
          <Pressable onPress={() => void Linking.openURL('https://crossub.com.au')}>
            <Text style={styles.link}>CROSSUB Web Portal</Text>
          </Pressable>
        </View>
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
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  outlineText: { color: colors.text, fontWeight: '600' },
  link: { color: colors.primary, fontSize: 13, textDecorationLine: 'underline' },
});
