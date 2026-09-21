import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAccount } from '@/src/account/account-context';
import { useLedger } from '@/src/account/ledger-context';
import { useAuth } from '@/src/auth/auth-context';
import { INSPECTOR_HOURLY_RATE_AUD } from '@/src/constants/inspection';
import {
  REGISTRATION_STATUS_LABEL,
  type RegistrationStatusKey,
} from '@/src/constants/inspector-registration';
import { useInspections } from '@/src/inspections/inspections-context';
import { displayName, formatCurrency, formatDate, isThisWeek, personInitials } from '@/src/lib/datetime';
import { inspectorLevelAllows } from '@/src/lib/inspector-access-level';
import {
  earningsPath,
  helpPath,
  historyPath,
  keyManagementPath,
  profilePath,
  settingsPath,
  tribunalPath,
  weeklyAvailabilityPath,
} from '@/src/lib/routes';
import { useOffline } from '@/src/offline/offline-context';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';

function statusLabel(status?: string | null): string | undefined {
  if (!status) return undefined;
  if (status in REGISTRATION_STATUS_LABEL) {
    return REGISTRATION_STATUS_LABEL[status as RegistrationStatusKey];
  }
  return status;
}

export default function MoreScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { registration, profile, accessLevel, tribunalQualified } = useAccount();
  const { completedJobs } = useInspections();
  const { weeklyEarnings, unclaimedEarnings } = useLedger();
  const { pendingSync } = useOffline();
  const name = user ? displayName(user) : 'Inspector';
  const initials = personInitials({
    firstName: user?.firstName,
    lastName: user?.lastName,
    fullName: name,
    email: user?.email,
  });
  const approved = registration?.registrationStatus === 'approved';
  const showTribunal = inspectorLevelAllows(accessLevel, 'tribunal');
  const weekJobs = completedJobs.filter((job) =>
    isThisWeek(job.scheduledTime || job.scheduledDate),
  );
  const menu = [
    {
      href: profilePath,
      icon: 'person-outline' as const,
      title: 'Professional profile',
      subtitle: 'Personal details, licence, service regions',
    },
    ...(showTribunal
      ? [
          {
            href: tribunalPath,
            icon: 'scale-outline' as const,
            title: 'Tribunal',
            subtitle: 'Apply for tribunal certification',
          },
        ]
      : []),
    {
      href: weeklyAvailabilityPath,
      icon: 'time-outline' as const,
      title: 'Time Availability',
      subtitle: 'Select the times you can take jobs',
    },
    {
      href: historyPath,
      icon: 'document-text-outline' as const,
      title: 'Job history',
      subtitle: 'Search completed inspections by address or suburb',
    },
    {
      href: earningsPath,
      icon: 'card-outline' as const,
      title: 'Payments',
      subtitle: 'History, payouts, unclaimed payments',
    },
    {
      href: keyManagementPath,
      icon: 'key-outline' as const,
      title: 'Key management',
      subtitle: 'Collect and return across assigned jobs',
    },
    {
      href: settingsPath,
      icon: 'settings-outline' as const,
      title: 'Settings',
      subtitle:
        pendingSync > 0
          ? `${pendingSync} change${pendingSync === 1 ? '' : 's'} waiting to sync`
          : 'Account, notifications, security',
    },
    {
      href: helpPath,
      icon: 'help-circle-outline' as const,
      title: 'Help & support',
      subtitle: 'FAQs, contact support',
    },
  ];

  return (
    <View style={styles.safe}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.inner}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <View style={styles.tags}>
              {approved ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{REGISTRATION_STATUS_LABEL.approved}</Text>
                </View>
              ) : registration?.registrationStatus ? (
                <View style={styles.badgeMuted}>
                  <Text style={styles.badgeMutedText}>
                    {statusLabel(registration.registrationStatus)}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.tribunalTag, tribunalQualified && styles.tribunalTagOn]}>
                <Ionicons
                  name="scale-outline"
                  size={11}
                  color={tribunalQualified ? '#fff' : colors.muted}
                />
                <Text
                  style={[styles.tribunalTagText, tribunalQualified && styles.tribunalTagTextOn]}
                >
                  Tribunal qualified
                </Text>
              </View>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {registration?.email ?? profile?.email ?? user?.email}
            </Text>
            {registration?.mobile || profile?.phone ? (
              <Text style={styles.meta} numberOfLines={1}>
                {registration?.mobile ?? profile?.phone}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="wallet-outline" size={16} color={colors.primary} />
            <Text style={styles.statValue}>{formatCurrency(weeklyEarnings)}</Text>
            <Text style={styles.statLabel}>This week</Text>
            <Text style={styles.statHint}>${INSPECTOR_HOURLY_RATE_AUD}/hr guideline</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={16} color={colors.primary} />
            <Text style={styles.statValue}>{weekJobs.length}</Text>
            <Text style={styles.statLabel}>Completed inspections</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="wallet-outline" size={16} color={colors.amber} />
            <Text style={[styles.statValue, { color: colors.amber }]}>
              {formatCurrency(unclaimedEarnings)}
            </Text>
            <Text style={styles.statLabel}>Unclaimed payments</Text>
          </View>
        </View>

        <View style={styles.nav}>
          {menu.map((item, index) => (
            <Pressable
              key={item.title}
              onPress={() => router.push(item.href as never)}
              style={[styles.row, index === menu.length - 1 && styles.rowLast]}
            >
              <Ionicons name={item.icon} size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text
                  style={[
                    styles.rowSub,
                    item.title === 'Settings' && pendingSync > 0 ? styles.rowSubWarn : null,
                  ]}
                >
                  {item.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        {registration?.submittedAt ? (
          <Text style={styles.member}>
            Member since {formatDate(registration.submittedAt)}
            {registration.reviewedAt
              ? ` · Last reviewed ${formatDate(registration.reviewedAt)}`
              : ''}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  inner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 20 },
  profile: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,212,164,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  name: { color: colors.text, fontSize: 20, fontWeight: '600' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: colors.primaryFg, fontSize: 10, fontWeight: '500' },
  badgeMuted: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeMutedText: { color: colors.muted, fontSize: 10, fontWeight: '500' },
  tribunalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(107,114,128,0.5)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tribunalTagOn: {
    backgroundColor: '#0ea5e9',
    borderStyle: 'solid',
    borderColor: '#0ea5e9',
  },
  tribunalTagText: { color: colors.muted, fontSize: 10, fontWeight: '500' },
  tribunalTagTextOn: { color: '#fff' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 8 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 8 },
  statLabel: { color: colors.muted, fontSize: 10, marginTop: 2, lineHeight: 13 },
  statHint: { color: colors.muted, fontSize: 10 },
  nav: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: '500' },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowSubWarn: { color: colors.amber },
  member: { color: colors.muted, fontSize: 11, textAlign: 'center' },
});
