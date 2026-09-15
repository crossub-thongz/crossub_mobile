import { useEffect, useMemo, useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useInspections } from '@/src/inspections/inspections-context';
import { formatInspectTime } from '@/src/lib/datetime';
import { jobDetail } from '@/src/lib/routes';
import { colors } from '@/src/theme';

const REMINDER_WINDOW_MS = 2 * 60 * 60 * 1000;

export function JobReminders() {
  const { todaysJobs } = useInspections();
  const router = useRouter();
  const shownRef = useRef<Set<string>>(new Set());

  const upcoming = useMemo(
    () =>
      todaysJobs.filter((job) => {
        if (job.status === 'completed' || job.status === 'declined' || job.status === 'awaiting_approval') {
          return false;
        }
        const diff = new Date(job.scheduledTime).getTime() - Date.now();
        return diff > 0 && diff <= REMINDER_WINDOW_MS;
      }),
    [todaysJobs],
  );

  useEffect(() => {
    for (const job of upcoming) {
      if (shownRef.current.has(job.id)) continue;
      shownRef.current.add(job.id);
      Alert.alert(
        `Upcoming: ${job.type} inspection`,
        `${formatInspectTime(job.scheduledTime)} - ${job.propertyAddress}`,
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Open', onPress: () => router.push(jobDetail(job.id)) },
        ],
      );
      break;
    }
  }, [upcoming, router]);

  if (upcoming.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {upcoming.length} reminder{upcoming.length === 1 ? '' : 's'} today
      </Text>
      {upcoming.map((job) => (
        <Pressable key={job.id} onPress={() => router.push(jobDetail(job.id))}>
          <Text style={styles.row} numberOfLines={1}>
            {formatInspectTime(job.scheduledTime)} · {job.propertyAddress}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.amberBorder,
    backgroundColor: colors.amberBg,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  title: { color: colors.amber, fontSize: 12, fontWeight: '700' },
  row: { color: colors.muted, fontSize: 12 },
});
