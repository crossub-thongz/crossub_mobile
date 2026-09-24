import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInbox } from '@/src/inbox/inbox-context';
import {
  loadSeenReportNotificationIds,
  markReportNotificationsSeen,
} from '@/src/inbox/seen-report-notifs';
import { useInspections } from '@/src/inspections/inspections-context';
import type { InspectorNotification } from '@/src/lib/inbox';
import { reportDecisionOf } from '@/src/lib/report-decision';
import { colors } from '@/src/theme';

const TOAST_MS = 8000;
const MORE_MS = 6000;

type Toast = {
  id: string;
  title: string;
  body: string;
  href: string;
  declined: boolean;
};

/**
 * In-app toast when an inspector report is approved or declined.
 * Unread decisions that this device has not already shown are toasted.
 */
export function ReportDecisionAlerts() {
  const { notifications, markNotificationRead } = useInbox();
  const { refresh: refreshJobs } = useInspections();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const seenRef = useRef<Set<string>>(new Set());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [seenReady, setSeenReady] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [more, setMore] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSeenReportNotificationIds().then((ids) => {
      if (cancelled) return;
      seenRef.current = ids;
      setSeenReady(true);
    });
    return () => {
      cancelled = true;
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (moreTimer.current) clearTimeout(moreTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!seenReady) return;
    const unseen: InspectorNotification[] = [];
    for (const item of notifications) {
      if (item.read) continue;
      if (!reportDecisionOf(item)) continue;
      if (seenRef.current.has(item.id)) continue;
      unseen.push(item);
    }
    if (unseen.length === 0) return;

    const first = unseen[0];
    const remaining = unseen.length - 1;
    const ids = unseen.map((item) => item.id);
    for (const id of ids) seenRef.current.add(id);
    void markReportNotificationsSeen(ids);
    void refreshJobs();

    const decision = reportDecisionOf(first);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({
      id: first.id,
      title: first.title,
      body: first.body,
      href: first.href,
      declined: decision === 'declined',
    });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);

    if (remaining > 0) {
      if (moreTimer.current) clearTimeout(moreTimer.current);
      setMore(
        `${remaining} more report update${remaining === 1 ? '' : 's'}. Open Notifications to review them.`,
      );
      moreTimer.current = setTimeout(() => setMore(null), MORE_MS);
    }
  }, [notifications, seenReady, refreshJobs]);

  if (!toast && !more) return null;

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {toast ? (
        <View style={[styles.toast, toast.declined ? styles.toastDeclined : styles.toastApproved]}>
          <View style={styles.copy}>
            <Text style={[styles.title, toast.declined ? styles.titleDeclined : styles.titleApproved]}>
              {toast.title}
            </Text>
            <Text style={styles.body}>{toast.body}</Text>
          </View>
          <Pressable
            onPress={() => {
              const href = toast.href;
              const id = toast.id;
              setToast(null);
              markNotificationRead(id);
              if (href) router.push(href as never);
            }}
            style={[styles.action, toast.declined ? styles.actionDeclined : styles.actionApproved]}
          >
            <Text style={styles.actionText}>Open</Text>
          </Pressable>
          <Pressable onPress={() => setToast(null)} accessibilityLabel="Dismiss" style={styles.dismiss}>
            <Ionicons name="close" size={16} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
      {more ? (
        <Pressable
          onPress={() => {
            setMore(null);
            router.push('/notifications' as never);
          }}
          style={styles.more}
        >
          <Text style={styles.moreText}>{more}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toastApproved: {
    borderColor: 'rgba(0,212,164,0.45)',
    backgroundColor: '#0f1a17',
  },
  toastDeclined: {
    borderColor: 'rgba(248,113,113,0.45)',
    backgroundColor: '#1a1010',
  },
  copy: { flex: 1, gap: 2 },
  title: { fontSize: 12, fontWeight: '700' },
  titleApproved: { color: colors.primary },
  titleDeclined: { color: colors.red },
  body: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  action: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  actionApproved: { backgroundColor: colors.primary },
  actionDeclined: { backgroundColor: colors.red },
  actionText: { color: '#0b0f10', fontSize: 11, fontWeight: '700' },
  dismiss: { paddingHorizontal: 4, paddingVertical: 4 },
  more: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  moreText: { color: colors.muted, fontSize: 11, lineHeight: 15 },
});
