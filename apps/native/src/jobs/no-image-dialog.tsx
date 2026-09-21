import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme';

export function NoImageDialog({
  open,
  onClose,
  message = 'No photo has been added yet. Add at least one photo to continue.',
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.iconWrap}>
            <Ionicons name="image-outline" size={28} color={colors.muted} />
          </View>
          <Text style={styles.title}>NO IMAGE</Text>
          <Text style={styles.body}>{message}</Text>
          <Pressable onPress={onClose} style={styles.ok}>
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '800', letterSpacing: 1, marginTop: 8 },
  body: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  ok: {
    marginTop: 12,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  okText: { color: colors.primaryFg, fontWeight: '700' },
});
