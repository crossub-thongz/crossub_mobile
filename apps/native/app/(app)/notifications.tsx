import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useInbox } from '@/src/inbox/inbox-context';
import { formatRelative } from '@/src/lib/datetime';
import { reportDecisionOf } from '@/src/lib/report-decision';
import { colors } from '@/src/theme';
import { AppHeader } from '@/src/ui/app-header';
import { EmptyState } from '@/src/ui/empty-state';

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, refreshing, refresh, markNotificationRead } = useInbox();

  return (
    <View style={styles.safe}>
      <AppHeader title="Notifications" />
      <ScrollView
        contentContainerStyle={styles.inner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refresh();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {notifications.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="No notifications"
            description="You're all caught up."
          />
        ) : (
          notifications.map((item) => {
            const decision = reportDecisionOf(item);
            return (
            <Pressable
              key={item.id}
              onPress={() => {
                markNotificationRead(item.id);
                router.push(item.href as never);
              }}
              style={[
                styles.card,
                item.read ? styles.cardRead : styles.cardUnread,
                decision === 'approved' && !item.read ? styles.cardApproved : null,
                decision === 'declined' && !item.read ? styles.cardDeclined : null,
              ]}
            >
              {decision ? (
                <Text style={decision === 'declined' ? styles.kindDeclined : styles.kindApproved}>
                  {decision === 'declined' ? 'Report declined' : 'Report approved'}
                </Text>
              ) : null}
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>{formatRelative(item.createdAt)}</Text>
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
  inner: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 8 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  cardUnread: {
    borderColor: 'rgba(0,212,164,0.3)',
    backgroundColor: 'rgba(0,212,164,0.05)',
  },
  cardApproved: {
    borderColor: 'rgba(0,212,164,0.55)',
    backgroundColor: 'rgba(0,212,164,0.08)',
  },
  cardDeclined: {
    borderColor: 'rgba(248,113,113,0.45)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  cardRead: {
    borderColor: 'rgba(28,35,38,0.6)',
    backgroundColor: 'rgba(28,35,38,0.1)',
    opacity: 0.7,
  },
  kindApproved: { color: colors.primary, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  kindDeclined: { color: colors.red, fontSize: 10, fontWeight: '700', marginBottom: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 12, marginTop: 4 },
  meta: { color: colors.muted, fontSize: 10, marginTop: 8 },
});
