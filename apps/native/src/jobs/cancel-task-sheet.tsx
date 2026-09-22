import { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { releaseInspection } from '@/src/api/inspector';
import { colors } from '@/src/theme';
import { AppTextInput } from '@/src/ui/app-text-input';

const MIN_REASON = 10;

export function CancelTaskSheet({
  visible,
  inspectionId,
  urgent,
  onClose,
  onReleased,
}: {
  visible: boolean;
  inspectionId: string;
  urgent?: boolean;
  onClose: () => void;
  onReleased: () => void;
}) {
  const [reason, setReason] = useState('');
  const [mode, setMode] = useState<'flag_admin' | 'release_pool'>('release_pool');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (reason.trim().length < MIN_REASON) {
      setError(`Describe why this task cannot be completed (min. ${MIN_REASON} characters)`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await releaseInspection(inspectionId, { reason: reason.trim(), mode });
      setReason('');
      onReleased();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel this task.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Cancel task</Text>
          <Text style={styles.body}>
            A reason is required. Ops will be notified as a critical alert.
          </Text>
          {urgent ? (
            <Text style={styles.banner}>
              Emergency task ù an additional $10 AUD will be added to this job's payout record.
            </Text>
          ) : null}
          <Text style={styles.label}>Reason for cancellation</Text>
          <AppTextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Describe why this task cannot be completed (min. 10 characters)"
            placeholderTextColor={colors.muted}
            multiline
            style={styles.input}
          />
          <Text style={styles.label}>What should happen next?</Text>
          <Pressable
            onPress={() => setMode('flag_admin')}
            style={[styles.option, mode === 'flag_admin' && styles.optionOn]}
          >
            <Text style={styles.optionText}>Flag cancellation to Admin</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('release_pool')}
            style={[styles.option, mode === 'release_pool' && styles.optionOn]}
          >
            <Text style={styles.optionText}>Release task back to job pool</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            <Pressable onPress={onClose} style={styles.secondary}>
              <Text style={styles.secondaryText}>Keep task</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void confirm();
              }}
              disabled={busy}
              style={styles.primary}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryFg} />
              ) : (
                <Text style={styles.primaryText}>Confirm cancel</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  banner: {
    color: colors.amber,
    backgroundColor: colors.amberBg,
    borderRadius: 8,
    padding: 8,
    fontSize: 12,
  },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    color: colors.text,
    minHeight: 80,
    padding: 10,
    textAlignVertical: 'top',
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: 'rgba(0,212,164,0.12)' },
  optionText: { color: colors.text, fontWeight: '600' },
  error: { color: colors.destructive, fontSize: 13 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primary: {
    flex: 1,
    backgroundColor: colors.destructive,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#ffffff', fontWeight: '700' },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { color: colors.text, fontWeight: '600' },
});
