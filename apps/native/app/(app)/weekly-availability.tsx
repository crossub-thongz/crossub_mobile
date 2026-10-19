import { ScrollView, StyleSheet, View } from 'react-native';

import { useSelfManagedRedirect } from '@/src/account/use-self-managed-redirect';
import { WeeklyTimetableCard } from '@/src/account/weekly-timetable-card';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { useScrollEndPadding } from '@/src/ui/use-scroll-end-padding';

export default function WeeklyAvailabilityScreen() {
  const blocked = useSelfManagedRedirect();
  const scrollEndPadding = useScrollEndPadding();
  if (blocked) return null;
  return (
    <View style={styles.safe}>
      <AppHeader title="Time Availability" backHref="/more" />
      <ScrollView contentContainerStyle={[styles.inner, { paddingBottom: scrollEndPadding }]}>
        <WeeklyTimetableCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16 },
});
