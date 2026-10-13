import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useOffline } from '@/src/offline/offline-context';
import { colors } from '@/src/theme';

/** Starts the upload the inspector asked for. Capture itself never calls this. */
export function SyncPendingButton({ hint }: { hint?: string }) {
  const { pendingSync, syncing, syncProgress, syncNow } = useOffline();
  if (!syncing && pendingSync <= 0) return null;
  const progress =
    syncing && syncProgress && syncProgress.total > 0
      ? `${syncProgress.completed} of ${syncProgress.total}`
      : '';
  const label = syncing
    ? progress
      ? `Sending photos ${progress}`
      : 'Sending photos'
    : `Sync ${pendingSync} saved`;
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          void syncNow(true).catch(() => undefined);
        }}
        disabled={syncing}
        style={[styles.bar, syncing && styles.barBusy]}
      >
        {syncing ? <ActivityIndicator color={colors.primaryFg} /> : null}
        <Text style={styles.text}>{label}</Text>
      </Pressable>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 8, gap: 6 },
  bar: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
  },
  barBusy: { opacity: 0.85 },
  text: { color: colors.primaryFg, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 16, textAlign: 'center' },
});
