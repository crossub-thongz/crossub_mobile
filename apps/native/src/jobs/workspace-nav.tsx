import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { jobInspectionContinuing } from '@/src/lib/inspection-job-cta';
import type { InspectionJob } from '@/src/lib/types';
import { colors } from '@/src/theme';
import { useInspections } from '@/src/inspections/inspections-context';

export type WorkspaceTab = 'details' | 'handover' | 'areas' | 'start';

export function parseWorkspaceTab(value: string | string[] | undefined): WorkspaceTab {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'handover' || raw === 'areas' || raw === 'start') return raw;
  return 'details';
}

export function parseKeysPhase(value: string | string[] | undefined): 'collect' | 'return' {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'return' ? 'return' : 'collect';
}

export function JobWorkspaceNav({
  job,
  active,
  onSelect,
}: {
  job: InspectionJob;
  active: WorkspaceTab;
  onSelect: (tab: WorkspaceTab) => void;
}) {
  const { getDraft } = useInspections();
  const continuing = jobInspectionContinuing(job, getDraft(job.id));
  const items: { id: WorkspaceTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'details', label: 'Job Details', icon: 'document-text-outline' },
    { id: 'handover', label: 'Handover', icon: 'key-outline' },
  ];
  if (job.type !== 'open') {
    items.push({ id: 'areas', label: 'Areas', icon: 'grid-outline' });
  }
  items.push({
    id: 'start',
    label: continuing ? 'Continue Inspection' : 'Start Inspection',
    icon: 'play',
  });

  return (
    <View style={styles.nav}>
      {items.map((item) => {
        const on = item.id === active;
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[styles.item, on && styles.itemOn]}
          >
            <Ionicons name={item.icon} size={16} color={on ? colors.primary : colors.muted} />
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  itemOn: { borderBottomColor: colors.primary },
  label: { color: colors.muted, fontSize: 10, fontWeight: '500' },
  labelOn: { color: colors.primary },
});
