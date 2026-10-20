import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/src/theme';

export function InspectionCompleteOverlay({
  open,
  submitting = false,
  title,
  subtitle,
  onDone,
}: {
  open: boolean;
  submitting?: boolean;
  title: string;
  subtitle?: string;
  onDone: () => void;
}) {
  const visible = open || submitting;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={submitting ? undefined : onDone}
    >
      <View
        style={styles.backdrop}
        accessibilityViewIsModal
        accessibilityLabel={submitting ? 'Submitting report' : title}
      >
        <View style={styles.body}>
          <View style={styles.ring}>
            <View style={styles.pulse} />
            {submitting ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
            )}
          </View>
          <Text style={styles.title}>{submitting ? 'Submitting report' : title}</Text>
          <Text style={styles.subtitle}>
            {submitting
              ? 'Your photos are already uploaded. The report is being built.'
              : subtitle}
          </Text>
          {submitting ? null : (
            <Pressable onPress={onDone} style={styles.cta}>
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,15,16,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  body: {
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    gap: 16,
  },
  ring: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(0,212,164,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 56,
    borderWidth: 2,
    borderColor: 'rgba(0,212,164,0.4)',
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cta: {
    marginTop: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: colors.primaryFg, fontWeight: '700' },
});
