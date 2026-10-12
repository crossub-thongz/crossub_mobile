import { Pressable, StyleSheet, Text } from 'react-native';

import { useOffline } from '@/src/offline/offline-context';
import { colors } from '@/src/theme';

/** Starts the upload the inspector asked for. Capture itself never calls this. */
export function SyncPendingButton() {
  const { pendingSync, syncing, syncProgress, syncNow } = useOffline();
  if (!syncing && pendingSync <= 0) return null;
  const progress =
    syncing && syncProgress ? ` ${syncProgress.completed}/${syncProgress.total}` : '';
  const label = syncing
    ? `Syncing${progress}`
    : `Sync ${pendingSync} saved`;
  return (
    <Pressable
      onPress={() => {
        void syncNow(true).catch(() => undefined);
      }}
      disabled={syncing}
      style={[styles.bar, syncing && styles.barBusy]}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  barBusy: { opacity: 0.7 },
  text: { color: colors.primaryFg, fontSize: 14, fontWeight: '700' },
});
