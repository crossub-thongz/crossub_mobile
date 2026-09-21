import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { WeeklyTimetableCard } from '@/src/account/weekly-timetable-card';
import { changePasswordPath } from '@/src/lib/routes';
import { useOffline } from '@/src/offline/offline-context';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

export default function SettingsScreen() {
  const router = useRouter();
  const { pendingSync, syncing, lastError, syncNow } = useOffline();

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
            Drafts and findings queue in SQLite. Photos stay as JPEG files on this
            phone, not in the database, and upload when the connection returns.
          </Text>
          {pendingSync > 0 ? (
            <Text style={styles.pending}>
              {pendingSync} change{pendingSync === 1 ? '' : 's'} waiting to sync
            </Text>
          ) : (
            <Text style={styles.body}>Nothing waiting to sync.</Text>
          )}
          {lastError ? <Text style={styles.danger}>{lastError}</Text> : null}
          <Pressable
            onPress={() => {
              void syncNow()
                .then((result) => {
                  if (result.synced > 0) {
                    Alert.alert('Synced', `${result.synced} change(s) uploaded.`);
                  } else if (result.remaining === 0) {
                    Alert.alert('Up to date', 'Nothing was waiting to sync.');
                  }
                })
                .catch((err) =>
                  Alert.alert('Sync failed', err instanceof Error ? err.message : 'Try again.'),
                );
            }}
            disabled={syncing}
            style={styles.outline}
          >
            <Text style={styles.outlineText}>{syncing ? 'Syncing...' : 'Sync now'}</Text>
          </Pressable>
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
  pending: { color: colors.amber, fontSize: 12 },
  danger: { color: colors.destructive, fontSize: 12 },
  link: { color: colors.primary, fontSize: 13, textDecorationLine: 'underline' },
});
