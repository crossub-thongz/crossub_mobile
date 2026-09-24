import Ionicons from '@expo/vector-icons/Ionicons';
import { usePathname, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import { colors } from '@/src/theme';
import { BackLabelButton } from '@/src/ui/back-label';
import { MORE_NAV_SECTIONS, moreNavForLevel } from '@/src/ui/more-nav';

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
  const { height: windowHeight } = useWindowDimensions();
  const { user, logout } = useAuth();
  const { accessLevel } = useAccount();
  const moreNav = useMemo(() => moreNavForLevel(accessLevel), [accessLevel]);
  const { receivingJobs, toggleReceivingJobs } = useInspections();
  const { unreadMessages, unreadNotifications } = useInbox();
  const [moreOpen, setMoreOpen] = useState(false);
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
  const menuMaxHeight = Math.round(windowHeight * 0.78);

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
            unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'
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
        accessibilityLabel={
          unreadNotifications > 0
            ? `Notifications, ${unreadNotifications} unread`
            : 'Notifications'
        }
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
    <SafeAreaView edges={['top']} style={styles.safe}>
      {variant === 'home' ? (
        <View style={styles.homeRow}>
          <Pressable onPress={() => go('/more')} style={styles.homeIdentity}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarRing}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.levelChip}>
                <Text style={styles.levelText} numberOfLines={1}>
                  {headerBadge(user?.role, accessLevel)}
                </Text>
              </View>
            </View>
            <View style={styles.homeCopy}>
              <Text style={styles.hello} numberOfLines={1}>
                {greetingForNow()}
              </Text>
              {name ? (
                <Text style={styles.homeName} numberOfLines={1}>
                  {name}
                </Text>
              ) : null}
              <Text style={styles.date} numberOfLines={1}>
                {formatLongDate()}
              </Text>
            </View>
          </Pressable>
          {actions}
        </View>
      ) : variant === 'workspace' ? (
        <View style={styles.workspaceRow}>
          {backHref ? (
            <BackLabelButton onPress={() => router.push(backHref as never)} />
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
              <BackLabelButton onPress={() => router.push(backHref as never)} />
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
          <SafeAreaView edges={['top']} pointerEvents="box-none">
            <View style={[styles.menu, { maxHeight: menuMaxHeight }]}>
              <View style={styles.menuHead}>
                <Text style={styles.menuKicker}>Menu</Text>
                <Pressable
                  onPress={() => setMoreOpen(false)}
                  hitSlop={12}
                  accessibilityLabel="Close menu"
                >
                  <Ionicons name="close" size={20} color={colors.muted} />
                </Pressable>
              </View>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.menuScroll}
              >
                {MORE_NAV_SECTIONS.map((section) => {
                  const items = moreNav.filter((item) => item.section === section.id);
                  if (items.length === 0) return null;
                  return (
                    <View key={section.id} style={styles.menuSection}>
                      <Text style={styles.menuSectionTitle}>{section.title}</Text>
                      {items.map((item) => (
                        <Pressable
                          key={`${item.href}-${item.label}`}
                          onPress={() => go(item.href)}
                          style={({ pressed }) => [
                            styles.menuItem,
                            pressed && styles.menuItemPressed,
                          ]}
                        >
                          <View style={styles.menuIcon}>
                            <Ionicons name={item.icon} size={18} color={colors.primary} />
                          </View>
                          <View style={styles.menuCopy}>
                            <Text style={styles.menuItemText}>{item.label}</Text>
                            <Text style={styles.menuItemSub} numberOfLines={1}>
                              {item.subtitle}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                        </Pressable>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={() => {
                  setMoreOpen(false);
                  void logout();
                }}
                style={styles.signOutBtn}
              >
                <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
                <Text style={styles.signOut}>Sign out</Text>
              </Pressable>
            </View>
          </SafeAreaView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  homeIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 56,
    height: 64,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: 'rgba(0,212,164,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
  levelChip: {
    position: 'absolute',
    bottom: 0,
    minWidth: 54,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  levelText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  homeCopy: { flex: 1, minWidth: 0, justifyContent: 'center' },
  hello: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  homeName: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 1 },
  date: { color: colors.muted, fontSize: 13, marginTop: 2 },
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
  homeActions: { alignSelf: 'flex-start', marginTop: 6 },
  receiving: {
    height: 32,
    maxWidth: 108,
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
  modalRoot: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  menu: {
    marginTop: 8,
    marginHorizontal: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    overflow: 'hidden',
  },
  menuHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  menuKicker: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  menuScroll: { paddingBottom: 8 },
  menuSection: { paddingHorizontal: 8, paddingBottom: 6 },
  menuSectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  menuItemPressed: { backgroundColor: colors.secondary },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0,212,164,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCopy: { flex: 1, minWidth: 0 },
  menuItemText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  menuItemSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  signOut: { color: colors.destructive, fontSize: 14, fontWeight: '600' },
});
