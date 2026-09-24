import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuth } from '@/src/auth/auth-context';
import { useInbox } from '@/src/inbox/inbox-context';
import { toNativeHref } from '@/src/lib/inbox';
import { registerInspectorPush } from '@/src/push/register-push';

function hrefFromNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const href = (data as { href?: unknown }).href;
  return typeof href === 'string' && href.trim() ? href : null;
}

/** Registers this device and opens job links from OS notification taps. */
export function InspectorPushBridge() {
  const { status } = useAuth();
  const { refresh } = useInbox();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authed' || Platform.OS === 'web') return;
    void registerInspectorPush().catch(() => undefined);
  }, [status]);

  useEffect(() => {
    if (status !== 'authed' || Platform.OS === 'web') return;
    const received = Notifications.addNotificationReceivedListener(() => {
      void refresh();
    });
    const tapped = Notifications.addNotificationResponseReceivedListener((response) => {
      const href = hrefFromNotificationData(response.notification.request.content.data);
      void refresh();
      if (href) router.push(toNativeHref(href) as never);
    });
    return () => {
      received.remove();
      tapped.remove();
    };
  }, [status, router, refresh]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && status === 'authed') {
        void registerInspectorPush().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [status]);

  return null;
}
