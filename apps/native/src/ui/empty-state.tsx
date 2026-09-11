import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme';

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.box}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={24} color={colors.muted} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(28,35,38,0.8)',
    backgroundColor: 'rgba(17,22,23,0.5)',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: colors.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  description: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    maxWidth: 280,
  },
});
