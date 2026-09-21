import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { settingsPath } from '@/src/lib/routes';
import { useOffline } from '@/src/offline/offline-context';
import { colors } from '@/src/theme';

export function PendingSyncBanner({ inset }: { inset?: boolean }) {
  const router = useRouter();
  const { pendingSync, syncing, syncNow } = useOffline();
  if (pendingSync <= 0) return null;

  return (
    <View style={[styles.banner, inset && styles.inset]}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.amber} />
      <Pressable
        onPress={() => router.push(settingsPath)}
        style={styles.copy}
        accessibilityRole="button"
        accessibilityLabel="Open Settings for offline sync"
      >
        <Text style={styles.text}>
          {pendingSync} change{pendingSync === 1 ? '' : 's'} waiting to sync
        </Text>
      </Pressable>
      <Pressable
        onPress={() => {
          void syncNow().catch(() => undefined);
        }}
        disabled={syncing}
        style={styles.sync}
      >
        {syncing ? (
          <ActivityIndicator color={colors.amber} size="small" />
        ) : (
          <Text style={styles.syncText}>Sync now</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    backgroundColor: colors.amberBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inset: { marginHorizontal: 16, marginTop: 8 },
  copy: { flex: 1, minWidth: 0 },
  text: { color: colors.amber, fontSize: 12, fontWeight: '600' },
  sync: {
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 72,
    alignItems: 'center',
  },
  syncText: { color: colors.amber, fontSize: 11, fontWeight: '700' },
});
