import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { InspectorInspection } from '@/src/api/inspector';
import {
  inspectionAddress,
  inspectionTypeLabel,
  inspectionWhen,
} from '@/src/inspections/format';

type InspectionRowProps = {
  item: InspectorInspection;
  actionLabel?: string;
  actionBusy?: boolean;
  actionDisabled?: boolean;
  onAction?: () => void;
  onPress?: () => void;
};

export function InspectionRow({
  item,
  actionLabel,
  actionBusy,
  actionDisabled,
  onAction,
  onPress,
}: InspectionRowProps) {
  const body = (
    <>
      <View style={styles.top}>
        <Text style={styles.type}>{inspectionTypeLabel(item.type)}</Text>
        {item.urgent ? <Text style={styles.urgent}>Urgent</Text> : null}
      </View>
      <Text style={styles.address}>{inspectionAddress(item)}</Text>
      <Text style={styles.meta}>
        {inspectionWhen(item)} - {item.status.replaceAll('_', ' ')}
      </Text>
    </>
  );

  return (
    <View style={styles.card}>
      {onPress ? (
        <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
          {body}
        </Pressable>
      ) : (
        body
      )}
      {onAction && actionLabel ? (
        <Pressable
          onPress={onAction}
          disabled={actionDisabled || actionBusy}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.actionPressed,
            (actionDisabled || actionBusy) && styles.actionDisabled,
          ]}
        >
          {actionBusy ? (
            <ActivityIndicator color="#111111" />
          ) : (
            <Text style={styles.actionText}>{actionLabel}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  type: {
    color: '#00d4a4',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  urgent: {
    color: '#111111',
    backgroundColor: '#f07171',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  address: { color: '#f4f4f4', fontSize: 16, fontWeight: '600' },
  meta: { color: '#8a8a8a', fontSize: 13, marginTop: 4 },
  action: {
    marginTop: 12,
    alignSelf: 'flex-start',
    backgroundColor: '#00d4a4',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 88,
    alignItems: 'center',
  },
  actionPressed: { opacity: 0.85 },
  actionDisabled: { opacity: 0.55 },
  actionText: { color: '#111111', fontWeight: '700' },
  pressed: { opacity: 0.85 },
});
