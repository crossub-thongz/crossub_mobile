import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { INSPECTION_PAY_LABEL } from '@/src/constants/inspection';
import { useInspections } from '@/src/inspections/inspections-context';
import { formatShortDate } from '@/src/lib/datetime';
import { jobAccessMethodLabel } from '@/src/lib/key-access';
import { propertyAddressLines } from '@/src/lib/property-address';
import { jobKeys } from '@/src/lib/routes';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

type KeyFilter = 'all' | 'collect' | 'return';

export default function KeyManagementScreen() {
  const router = useRouter();
  const { jobs } = useInspections();
  const [filter, setFilter] = useState<KeyFilter>('all');
  const keyed = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.keyAccess &&
          job.status !== 'declined' &&
          job.status !== 'available',
      ),
    [jobs],
  );
  const rows = useMemo(() => {
    if (filter === 'collect') {
      return keyed.filter((job) => job.keyAccess && !job.keyAccess.collectComplete);
    }
    if (filter === 'return') {
      return keyed.filter(
        (job) =>
          job.keyAccess &&
          job.keyAccess.collectComplete &&
          !job.keyAccess.returnComplete,
      );
    }
    return keyed;
  }, [filter, keyed]);

  return (
    <View style={styles.safe}>
      <AppHeader title="Key management" backHref="/more" />
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.lede}>
          Collect and return still happen on the job. This list is every key set on your
          assigned work.
        </Text>
        <View style={styles.filters}>
          {(
            [
              { id: 'all' as const, label: 'All' },
              { id: 'collect' as const, label: 'Collect' },
              { id: 'return' as const, label: 'Return' },
            ]
          ).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setFilter(item.id)}
              style={[styles.chip, filter === item.id && styles.chipOn]}
            >
              <Text style={[styles.chipText, filter === item.id && styles.chipTextOn]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {rows.length === 0 ? (
          <EmptyState
            icon="key-outline"
            title={filter === 'all' ? 'No key collections' : `No keys to ${filter}`}
            description="Jobs that need a key collect or return will show here. Open a job to record the handover."
          />
        ) : (
          rows.map((job) => {
            const { street, locality } = propertyAddressLines(job);
            const collectDone = Boolean(job.keyAccess?.collectComplete);
            const returnDone = Boolean(job.keyAccess?.returnComplete);
            const phase: 'collect' | 'return' = collectDone ? 'return' : 'collect';
            return (
              <Pressable
                key={job.id}
                onPress={() => router.push(jobKeys(job.id, phase))}
                style={styles.card}
              >
                <View style={styles.top}>
                  <Text style={styles.type}>{INSPECTION_PAY_LABEL[job.type]}</Text>
                  <Text style={styles.when}>
                    {formatShortDate(job.scheduledDate || job.scheduledTime)}
                  </Text>
                </View>
                <Text style={styles.street}>{street}</Text>
                {locality ? <Text style={styles.locality}>{locality}</Text> : null}
                <Text style={styles.meta}>{jobAccessMethodLabel(job)}</Text>
                <View style={styles.pills}>
                  <View style={[styles.pill, collectDone && styles.pillOn]}>
                    <Ionicons
                      name={collectDone ? 'checkmark' : 'download-outline'}
                      size={12}
                      color={collectDone ? colors.primary : colors.muted}
                    />
                    <Text style={[styles.pillText, collectDone && styles.pillTextOn]}>
                      Collect
                    </Text>
                  </View>
                  <View style={[styles.pill, returnDone && styles.pillOn]}>
                    <Ionicons
                      name={returnDone ? 'checkmark' : 'return-up-back-outline'}
                      size={12}
                      color={returnDone ? colors.primary : colors.muted}
                    />
                    <Text style={[styles.pillText, returnDone && styles.pillTextOn]}>
                      Return
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40, gap: 10 },
  lede: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  filters: { flexDirection: 'row', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  chipTextOn: { color: colors.primaryFg },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  type: { color: colors.primary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  when: { color: colors.muted, fontSize: 11 },
  street: { color: colors.text, fontSize: 16, fontWeight: '600' },
  locality: { color: colors.muted, fontSize: 12 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pills: { flexDirection: 'row', gap: 8, marginTop: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillOn: { borderColor: 'rgba(0,212,164,0.5)', backgroundColor: 'rgba(0,212,164,0.1)' },
  pillText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  pillTextOn: { color: colors.primary },
});
