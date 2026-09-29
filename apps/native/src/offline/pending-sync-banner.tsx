import { StyleSheet, Text, View } from 'react-native';

import { useOffline } from '@/src/offline/offline-context';
import { colors } from '@/src/theme';

export function PendingSyncBanner({ inset }: { inset?: boolean }) {
  const { syncProgress } = useOffline();
  const total = syncProgress?.total ?? 0;
  const completed = syncProgress?.completed ?? 0;
  if (total <= 0 || completed >= total) return null;
  const ratio = Math.min(1, completed / total);

  return (
    <View style={[styles.banner, inset && styles.inset]}>
      <Text style={styles.text}>{`Uploading ${completed} of ${total}`}</Text>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: total, now: completed }}
      >
        <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: 8,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    backgroundColor: colors.amberBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inset: { marginHorizontal: 16, marginTop: 8 },
  text: { color: colors.amber, fontSize: 12, fontWeight: '600' },
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(251,191,36,0.25)',
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 999, backgroundColor: colors.amber },
});
