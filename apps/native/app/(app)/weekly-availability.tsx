import { ScrollView, StyleSheet, View } from 'react-native';

import { WeeklyTimetableCard } from '@/src/account/weekly-timetable-card';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

export default function WeeklyAvailabilityScreen() {
  return (
    <View style={styles.safe}>
      <AppHeader title="Time Availability" backHref="/more" />
      <ScrollView contentContainerStyle={styles.inner}>
        <WeeklyTimetableCard />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { padding: 16, paddingBottom: 40 },
});
