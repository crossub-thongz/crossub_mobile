import { StyleSheet, Text, View } from 'react-native';

import { useAccount } from '@/src/account/account-context';
import { useAuth } from '@/src/auth/auth-context';
import { useInspections } from '@/src/inspections/inspections-context';
import {
  DirectionsButton,
  PropertyHeaderBody,
} from '@/src/jobs/job-property-header';
import { JobPayBreakdown, JobTravelCard } from '@/src/jobs/job-travel-pay';
import { displayName } from '@/src/lib/datetime';
import type { InspectionJob } from '@/src/lib/types';
import { colors } from '@/src/theme';

export function JobSummaryCard({
  job,
  showPayout = true,
}: {
  job: InspectionJob;
  showPayout?: boolean;
}) {
  const { deviceLocation } = useInspections();
  const { user } = useAuth();
  const { profile } = useAccount();
  const inspectorName = user
    ? displayName(user)
    : displayName(profile ?? {});

  return (
    <View style={styles.card}>
      <PropertyHeaderBody job={job} inspectorName={inspectorName} />
      <DirectionsButton job={job} origin={deviceLocation} />
      <JobTravelCard job={job} deviceLocation={deviceLocation} />
      {showPayout ? (
        <View style={styles.payout}>
          <Text style={styles.payoutLabel}>Job payout</Text>
          <JobPayBreakdown
            hours={job.estimatedHours}
            laborAmount={job.laborAmount}
            durationLabel={job.durationLabel}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  payout: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 4,
  },
  payoutLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
