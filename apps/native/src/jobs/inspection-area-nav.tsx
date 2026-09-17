import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme';

export function inspectionAreaProgressColor(current: boolean, complete: boolean): string {
  if (current) return colors.amber;
  if (complete) return colors.primary;
  return '#ffffff';
}

export function InspectionAreaNav({
  names,
  areaIndex,
  isComplete,
  onGoToArea,
}: {
  names: string[];
  areaIndex: number;
  isComplete: (index: number, name: string) => boolean;
  onGoToArea: (index: number) => void;
}) {
  const total = names.length;
  const current = names[areaIndex];
  const canPrev = areaIndex > 0;
  const canNext = areaIndex < total - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable
          onPress={() => onGoToArea(areaIndex - 1)}
          disabled={!canPrev}
          style={[styles.chevron, !canPrev && styles.disabled]}
          accessibilityLabel="Previous area"
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {current ?? 'Area'}
          </Text>
          <Text style={styles.sub}>{total === 0 ? '0 of 0' : `${areaIndex + 1} of ${total}`}</Text>
        </View>
        <Pressable
          onPress={() => onGoToArea(areaIndex + 1)}
          disabled={!canNext}
          style={[styles.chevron, !canNext && styles.disabled]}
          accessibilityLabel="Next area"
        >
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.bars}>
        <View style={styles.barRow}>
          {names.map((name, index) => (
            <Pressable
              key={`${index}:${name}`}
              onPress={() => onGoToArea(index)}
              style={[
                styles.bar,
                { backgroundColor: inspectionAreaProgressColor(index === areaIndex, isComplete(index, name)) },
              ]}
              accessibilityLabel={`Go to ${name}`}
            />
          ))}
        </View>
        <Text style={styles.count}>{total === 0 ? '0/0' : `${areaIndex + 1}/${total}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  chevron: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
  titleBlock: { flex: 1, minWidth: 0, alignItems: 'center' },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barRow: { flex: 1, flexDirection: 'row', gap: 4, minWidth: 0 },
  bar: { flex: 1, height: 6, borderRadius: 999 },
  count: { color: colors.muted, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
