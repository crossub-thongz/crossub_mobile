import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { jobInspectionContinuing } from '@/src/lib/inspection-job-cta';
import { jobAreas, jobDetail, jobInspect, jobKeys } from '@/src/lib/routes';
import type { InspectionJob } from '@/src/lib/types';
import { colors } from '@/src/theme';
import { useInspections } from '@/src/inspections/inspections-context';

type WorkspaceTab = 'details' | 'handover' | 'areas' | 'start';

export function JobWorkspaceNav({
  job,
  active,
}: {
  job: InspectionJob;
  active: WorkspaceTab;
}) {
  const router = useRouter();
  const { getDraft } = useInspections();
  const continuing = jobInspectionContinuing(job, getDraft(job.id));
  const items: { id: WorkspaceTab; href: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] =
    [
      { id: 'details', href: jobDetail(job.id), label: 'Job Details', icon: 'document-text-outline' },
      { id: 'handover', href: jobKeys(job.id), label: 'Handover', icon: 'key-outline' },
    ];
  if (job.type !== 'open') {
    items.push({
      id: 'areas',
      href: jobAreas(job.id, job.type),
      label: 'Areas',
      icon: 'grid-outline',
    });
  }
  items.push({
    id: 'start',
    href: jobInspect(job.id, job.type),
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
            onPress={() => router.push(item.href as never)}
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
