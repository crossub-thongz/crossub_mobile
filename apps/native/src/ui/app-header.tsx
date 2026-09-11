import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from '@/src/account/account-context';
import { useAuth } from '@/src/auth/auth-context';
import { useInbox } from '@/src/inbox/inbox-context';
import { useInspections } from '@/src/inspections/inspections-context';
import {
  displayName,
  formatLongDate,
  greetingForNow,
  headerBadge,
  personInitials,
} from '@/src/lib/datetime';
import { inspectorLevelAllows } from '@/src/lib/inspector-access-level';
import { colors } from '@/src/theme';

const MORE_NAV_BASE = [
  { href: '/open-batch', label: 'Open task pool', need: 'open' as const },
  { href: '/inspect?tab=completed', label: 'Job history', need: null },
  { href: '/earnings', label: 'Earnings', need: null },
  { href: '/key-management', label: 'Key management', need: null },
  { href: '/register', label: 'Registration', need: null },
  { href: '/messages', label: 'Messages', need: null },
  { href: '/notifications', label: 'Notifications', need: null },
  { href: '/settings', label: 'Settings', need: null },
  { href: '/profile', label: 'Profile', need: null },
] as const;

export function AppHeader({
  variant = 'default',
  title,
  backHref,
}: {
  variant?: 'default' | 'home' | 'workspace';
  title?: string;
  backHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { accessLevel } = useAccount();
  const moreNav = MORE_NAV_BASE.filter(
    (item) => item.need !== 'open' || inspectorLevelAllows(accessLevel, 'open'),
  );
  const { receivingJobs, toggleReceivingJobs } = useInspections();
  const { unreadMessages, unreadNotifications } = useInbox();
  const [moreOpen, setMoreOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(56);
  const name = user ? displayName(user) : '';
  const initials = personInitials({
    firstName: user?.firstName,
    lastName: user?.lastName,
    fullName: name,
    email: user?.email,
  });
  const isMessageThread = /\/messages\/[^/]+/.test(pathname);
  const showReceiving = Boolean(user) && !isMessageThread;
  const showMessages = Boolean(user) && !isMessageThread;

  const go = (href: string) => {
    setMoreOpen(false);
    router.push(href as never);
  };

  const actions = (
    <View style={[styles.actions, variant === 'home' && styles.homeActions]}>
      {showReceiving ? (
        <Pressable
          onPress={toggleReceivingJobs}
          accessibilityLabel={receivingJobs ? 'Receiving jobs' : 'On break'}
          style={[styles.receiving, receivingJobs ? styles.receivingOn : styles.receivingOff]}
        >
          <Ionicons
            name={receivingJobs ? 'radio-outline' : 'cafe-outline'}
            size={14}
            color={receivingJobs ? '#6ee7b7' : '#fca5a5'}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.receivingText,
              receivingJobs ? styles.receivingTextOn : styles.receivingTextOff,
            ]}
          >
            {receivingJobs ? 'Receiving' : 'Break'}
          </Text>
        </Pressable>
      ) : null}

      {showMessages ? (
        <Pressable
          onPress={() => go('/messages')}
          style={styles.iconBtn}
          accessibilityLabel={
            unreadMessages > 0 ? `Messages  ${unreadMessages} unread` : 'Messages'
          }
        >
          <Ionicons name="chatbox-outline" size={20} color={colors.muted} />
          {unreadMessages > 0 ? (
            <View style={styles.messageBadge}>
              <Text style={styles.messageBadgeText}>
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => go('/notifications')}
        style={styles.iconBtn}
        accessibilityLabel="Notifications"
      >
        <Ionicons name="notifications-outline" size={20} color={colors.muted} />
        {unreadNotifications > 0 ? <View style={styles.notifDot} /> : null}
      </Pressable>

      <Pressable
        onPress={() => setMoreOpen((open) => !open)}
        style={styles.iconBtn}
        accessibilityLabel="Menu"
      >
        <Ionicons name="menu" size={20} color={colors.muted} />
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={styles.safe}
      onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
    >
      {variant === 'home' ? (
        <View style={styles.homeRow}>
          <Pressable onPress={() => go('/more')} style={styles.homeIdentity}>
            <View style={styles.avatarCol}>
              <View style={styles.avatarRing}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.levelChip}>
                <Text style={styles.levelText}>{headerBadge(user?.role, accessLevel)}</Text>
              </View>
            </View>
            <View style={styles.homeCopy}>
              <Text style={styles.hello} numberOfLines={1}>
                {greetingForNow()}, {name}
              </Text>
              <Text style={styles.date}>{formatLongDate()}</Text>
            </View>
          </Pressable>
          {actions}
        </View>
      ) : variant === 'workspace' ? (
        <View style={styles.workspaceRow}>
          {backHref ? (
            <Pressable onPress={() => router.push(backHref as never)} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={20} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.brandIconLg}>
              <Ionicons name="clipboard" size={16} color={colors.primary} />
            </View>
          )}
          <Text style={styles.workspaceTitle} numberOfLines={1}>
            {title}
          </Text>
          {actions}
        </View>
      ) : (
        <>
          <View style={styles.defaultRow}>
            {backHref ? (
              <Pressable onPress={() => router.push(backHref as never)}>
                <Text style={styles.back}>? Back</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => go('/')} style={styles.brand}>
                <View style={styles.brandIcon}>
                  <Ionicons name="clipboard" size={16} color={colors.primary} />
                </View>
                <Text style={styles.brandText}>CROSSUB Inspector</Text>
              </Pressable>
            )}
            {actions}
          </View>
          {title ? (
            <View style={styles.subtitleRow}>
              <Text style={styles.subtitle} numberOfLines={1}>
                {title}
              </Text>
              {user ? (
                <Text style={styles.userLine} numberOfLines={1}>
                  {name}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMoreOpen(false)} />
          <View style={[styles.menu, { top: headerHeight }]}>
            <Text style={styles.menuKicker}>More</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {moreNav.map((item) => (
                <Pressable
                  key={`${item.href}-${item.label}`}
                  onPress={() => go(item.href)}
                  style={styles.menuItem}
                >
                  <Text style={styles.menuItemText}>{item.label}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setMoreOpen(false);
                  void logout();
                }}
                style={styles.menuItem}
              >
                <Text style={styles.signOut}>Sign out</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    zIndex: 40,
  },
  homeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  homeIdentity: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  avatarCol: { width: 48, alignItems: 'center', gap: 4 },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: 'rgba(0,212,164,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: 14, fontWeight: '700', letterSpacing: 0.4 },
  levelChip: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  levelText: { color: colors.primary, fontSize: 10, fontWeight: '500' },
  homeCopy: { flex: 1, minWidth: 0, paddingTop: 2 },
  hello: { color: colors.text, fontSize: 18, fontWeight: '600' },
  date: { color: colors.muted, fontSize: 14, marginTop: 4 },
  workspaceRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  workspaceTitle: { flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' },
  defaultRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
  },
  back: { color: colors.primary, fontSize: 14, fontWeight: '500' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,212,164,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconLg: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(0,212,164,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  subtitleRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  subtitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  userLine: { color: colors.muted, fontSize: 12, marginTop: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  homeActions: { paddingTop: 4 },
  receiving: {
    height: 32,
    maxWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
  },
  receivingOn: {
    borderColor: 'rgba(16,185,129,0.5)',
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  receivingOff: {
    borderColor: 'rgba(239,68,68,0.5)',
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  receivingText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  receivingTextOn: { color: '#6ee7b7' },
  receivingTextOff: { color: '#fca5a5' },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  messageBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  messageBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  notifDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.destructive,
  },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  menu: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: 384,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  menuKicker: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  menuItem: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  menuItemText: { color: colors.text, fontSize: 14 },
  signOut: { color: colors.destructive, fontSize: 14 },
});
