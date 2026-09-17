import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme';

export function InspectionAreaActionBar({
  checked,
  total,
  issues,
  busy = false,
  busyLabel,
  isLast,
  onNext,
}: {
  checked: number;
  total: number;
  issues: number;
  busy?: boolean;
  busyLabel?: string;
  isLast: boolean;
  onNext: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.ring}>
        <Text style={styles.ringText}>
          {checked}/{total}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Items checked</Text>
        <Text style={[styles.issues, issues > 0 && styles.issuesOn]}>
          {issues > 0 ? `${issues} issue${issues === 1 ? '' : 's'} found` : 'No issues found'}
        </Text>
      </View>
      <Pressable onPress={onNext} disabled={busy} style={[styles.next, busy && styles.disabled]}>
        {busy ? (
          <Text style={styles.nextText}>{busyLabel ?? 'Uploading photos...'}</Text>
        ) : (
          <>
            <Text style={styles.nextText}>{isLast ? 'Complete' : 'Next area'}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primaryFg} />
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  ring: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 4,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: { color: colors.text, fontSize: 10, fontWeight: '700', fontVariant: ['tabular-nums'] },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 12, fontWeight: '700' },
  issues: { color: colors.muted, fontSize: 11, marginTop: 2 },
  issuesOn: { color: colors.destructive },
  next: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 44,
    minWidth: 136,
    flexGrow: 1.1,
    flexBasis: 136,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  nextText: { color: colors.primaryFg, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
