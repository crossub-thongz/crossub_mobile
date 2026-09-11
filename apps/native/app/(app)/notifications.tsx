import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useInbox } from '@/src/inbox/inbox-context';
import { formatRelative } from '@/src/lib/datetime';
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
          notifications.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                markNotificationRead(item.id);
                router.push(item.href as never);
              }}
              style={[styles.card, item.read ? styles.cardRead : styles.cardUnread]}
            >
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.meta}>{formatRelative(item.createdAt)}</Text>
            </Pressable>
          ))
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
  cardRead: {
    borderColor: 'rgba(28,35,38,0.6)',
    backgroundColor: 'rgba(28,35,38,0.1)',
    opacity: 0.7,
  },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 12, marginTop: 4 },
  meta: { color: colors.muted, fontSize: 10, marginTop: 8 },
});
