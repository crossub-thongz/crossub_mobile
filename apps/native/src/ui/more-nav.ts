import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import { inspectorLevelAllows, type InspectorAccessLevel } from '@/src/lib/inspector-access-level';
import {
  earningsPath,
  helpPath,
  historyPath,
  keyManagementPath,
  messagesPath,
  notificationsPath,
  openBatchPath,
  profilePath,
  registerPath,
  settingsPath,
  tribunalPath,
  weeklyAvailabilityPath,
} from '@/src/lib/routes';

export type MoreIcon = ComponentProps<typeof Ionicons>['name'];

export type MoreNavItem = {
  href: string;
  label: string;
  subtitle: string;
  icon: MoreIcon;
  section: 'work' | 'account' | 'support';
  need?: 'open' | 'tribunal';
};

export const MORE_NAV_SECTIONS: { id: MoreNavItem['section']; title: string }[] = [
  { id: 'work', title: 'Work' },
  { id: 'account', title: 'Account' },
  { id: 'support', title: 'Support' },
];

export const MORE_NAV_ITEMS: MoreNavItem[] = [
  {
    href: openBatchPath,
    label: 'Open task pool',
    subtitle: 'Saturday opens and route planner',
    icon: 'calendar-outline',
    section: 'work',
    need: 'open',
  },
  {
    href: weeklyAvailabilityPath,
    label: 'Time Availability',
    subtitle: 'Select the times you can take jobs',
    icon: 'time-outline',
    section: 'work',
  },
  {
    href: historyPath,
    label: 'Job history',
    subtitle: 'Search completed inspections by address or suburb',
    icon: 'document-text-outline',
    section: 'work',
  },
  {
    href: earningsPath,
    label: 'Payments',
    subtitle: 'History, payouts, unclaimed payments',
    icon: 'card-outline',
    section: 'work',
  },
  {
    href: keyManagementPath,
    label: 'Key management',
    subtitle: 'Collect and return across assigned jobs',
    icon: 'key-outline',
    section: 'work',
  },
  {
    href: tribunalPath,
    label: 'Tribunal',
    subtitle: 'Apply for tribunal certification',
    icon: 'scale-outline',
    section: 'work',
    need: 'tribunal',
  },
  {
    href: profilePath,
    label: 'Professional profile',
    subtitle: 'Personal details, licence, service regions',
    icon: 'person-outline',
    section: 'account',
  },
  {
    href: registerPath,
    label: 'Registration',
    subtitle: 'Licence, bank, and approval status',
    icon: 'shield-checkmark-outline',
    section: 'account',
  },
  {
    href: messagesPath,
    label: 'Messages',
    subtitle: 'Threads with CROSSUB and agents',
    icon: 'chatbox-outline',
    section: 'account',
  },
  {
    href: notificationsPath,
    label: 'Notifications',
    subtitle: 'Job alerts and office updates',
    icon: 'notifications-outline',
    section: 'account',
  },
  {
    href: settingsPath,
    label: 'Settings',
    subtitle: 'Account, notifications, security',
    icon: 'settings-outline',
    section: 'account',
  },
  {
    href: helpPath,
    label: 'Help & support',
    subtitle: 'FAQs, contact support',
    icon: 'help-circle-outline',
    section: 'support',
  },
];

export function moreNavForLevel(accessLevel: InspectorAccessLevel): MoreNavItem[] {
  return MORE_NAV_ITEMS.filter((item) => {
    if (item.need === 'open') return inspectorLevelAllows(accessLevel, 'open');
    if (item.need === 'tribunal') return inspectorLevelAllows(accessLevel, 'tribunal');
    return true;
  });
}
