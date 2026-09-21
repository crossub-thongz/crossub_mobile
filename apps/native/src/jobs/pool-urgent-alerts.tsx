import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useInspections } from '@/src/inspections/inspections-context';
import { formatInspectTime } from '@/src/lib/datetime';
import { jobDetail } from '@/src/lib/routes';
import type { InspectionJob } from '@/src/lib/types';
import { colors } from '@/src/theme';

const MAX_TOASTS_PER_SWEEP = 1;
const TOAST_MS = 8000;
const MORE_MS = 6000;

type Toast = {
  id: string;
  title: string;
  description: string;
  href?: string;
};

/**
 * Bottom toast when a pool job becomes urgent while Receiving is on.
 * First pool snapshot is seeded without toasting so already-urgent jobs do not flood.
 */
export function PoolUrgentAlerts() {
  const { pool, receivingJobs, loading } = useInspections();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const previousPriorityRef = useRef<Map<string, 'normal' | 'urgent'>>(new Map());
  const alertedRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [more, setMore] = useState<string | null>(null);

  const clearToastTimer = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = null;
  };
  const clearMoreTimer = () => {
    if (moreTimer.current) clearTimeout(moreTimer.current);
    moreTimer.current = null;
  };

  useEffect(() => {
    return () => {
      clearToastTimer();
      clearMoreTimer();
    };
  }, []);

  useEffect(() => {
    if (!receivingJobs) {
      hydratedRef.current = false;
      previousPriorityRef.current.clear();
      setToast(null);
      setMore(null);
      return;
    }
    if (loading) return;

    const previous = previousPriorityRef.current;
    const alerted = alertedRef.current;

    if (!hydratedRef.current) {
      if (pool.length === 0) return;
      for (const job of pool) {
        previous.set(job.id, job.priority);
        if (job.priority === 'urgent') alerted.add(job.id);
      }
      hydratedRef.current = true;
      return;
    }

    const newlyUrgent: InspectionJob[] = [];
    for (const job of pool) {
      const was = previous.get(job.id);
      previous.set(job.id, job.priority);
      if (job.priority !== 'urgent') continue;
      if (was === 'urgent') continue;
      if (alerted.has(job.id)) continue;
      newlyUrgent.push(job);
    }

    if (newlyUrgent.length === 0) return;

    const toShow = newlyUrgent.slice(0, MAX_TOASTS_PER_SWEEP);
    const remaining = newlyUrgent.length - toShow.length;
    for (const job of newlyUrgent) alerted.add(job.id);

    const job = toShow[0];
    if (job) {
      clearToastTimer();
      setToast({
        id: job.id,
        title: `URGENT - ${job.type} inspection needs acceptance`,
        description: `${job.propertyAddress} - due ${formatInspectTime(job.scheduledTime)}`,
        href: jobDetail(job.id),
      });
      toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
    }

    if (remaining > 0) {
      clearMoreTimer();
      setMore(
        `${remaining} more urgent pool job${remaining === 1 ? '' : 's'} waiting. Open the Job Pool to review them.`,
      );
      moreTimer.current = setTimeout(() => setMore(null), MORE_MS);
    }
  }, [pool, receivingJobs, loading]);

  if (!toast && !more) return null;

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {toast ? (
        <View style={styles.toast}>
          <View style={styles.copy}>
            <Text style={styles.title}>{toast.title}</Text>
            <Text style={styles.body}>{toast.description}</Text>
          </View>
          {toast.href ? (
            <Pressable
              onPress={() => {
                const href = toast.href;
                setToast(null);
                if (href) router.push(href as never);
              }}
              style={styles.action}
            >
              <Text style={styles.actionText}>Open job</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setToast(null)} accessibilityLabel="Dismiss" style={styles.dismiss}>
            <Ionicons name="close" size={16} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
      {more ? (
        <Pressable
          onPress={() => {
            setMore(null);
            router.push('/pool' as never);
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
    borderColor: 'rgba(248,113,113,0.45)',
    backgroundColor: '#1a1010',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  copy: { flex: 1, gap: 2 },
  title: { color: colors.red, fontSize: 12, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  action: {
    borderRadius: 8,
    backgroundColor: colors.red,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionText: { color: '#fff', fontSize: 11, fontWeight: '700' },
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
