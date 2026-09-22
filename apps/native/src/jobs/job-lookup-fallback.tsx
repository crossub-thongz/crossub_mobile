import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { JobLookupMiss } from '@/src/lib/job-lookup';
import { colors } from '@/src/theme';

/**
 * The screen a job route shows when `getJob(id)` returns nothing - a spinner
 * while the job list (and optional GET-by-id) is still loading, the not-found
 * message only once both have finished.
 */
export function JobLookupFallback({
  state,
  missingTitle = 'Job not found',
  missingMessage = 'This job could not be found.',
}: {
  state: JobLookupMiss;
  missingTitle?: string;
  missingMessage?: string;
}) {
  if (state === 'loading') {
    return (
      <View style={styles.box}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.muted}>Loading this job...</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{missingTitle}</Text>
      <Text style={styles.muted}>{missingMessage}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  muted: { color: colors.muted, fontSize: 13 },
});
