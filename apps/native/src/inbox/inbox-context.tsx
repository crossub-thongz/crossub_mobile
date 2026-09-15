import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  createInspectorMessage,
  fetchInspectorMessages,
  fetchInspectorNotifications,
  markInspectorNotificationRead,
  replyInspectorMessage,
} from '@/src/api/inspector';
import { useAuth } from '@/src/auth/auth-context';
import {
  mapMessageThreads,
  mapNotifications,
  type InspectorNotification,
  type MessageThread,
  type ThreadMessage,
} from '@/src/lib/inbox';

type InboxContextValue = {
  messages: MessageThread[];
  notifications: InspectorNotification[];
  unreadMessages: number;
  unreadNotifications: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getThreadMessages: (id: string) => ThreadMessage[];
  markNotificationRead: (id: string) => void;
  createThread: (input: {
    subject: string;
    body: string;
    inspectionId?: string;
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      contentBase64: string;
    }>;
  }) => Promise<string>;
  sendReply: (
    threadId: string,
    body: string,
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      contentBase64: string;
    }>,
  ) => Promise<void>;
};

const InboxContext = createContext<InboxContextValue | undefined>(undefined);

export function InboxProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [messages, setMessages] = useState<MessageThread[]>([]);
  const [threadMessages, setThreadMessages] = useState<Record<string, ThreadMessage[]>>({});
  const [notifications, setNotifications] = useState<InspectorNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [threadDtos, notificationDtos] = await Promise.all([
        fetchInspectorMessages(),
        fetchInspectorNotifications(),
      ]);
      const mapped = mapMessageThreads(threadDtos);
      setMessages(mapped.threads);
      setThreadMessages(mapped.messagesByThread);
      setNotifications(mapNotifications(notificationDtos));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status !== 'authed') return;
    void load('initial');
  }, [status, load]);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  const getThreadMessages = useCallback(
    (id: string) => threadMessages[id] ?? [],
    [threadMessages],
  );

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((current) =>
      current.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    void markInspectorNotificationRead(id).catch(() => undefined);
  }, []);

  const createThread = useCallback(
    async (input: {
      subject: string;
      body: string;
      inspectionId?: string;
      attachments?: Array<{
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        contentBase64: string;
      }>;
    }) => {
      const thread = await createInspectorMessage({
        subject: input.subject,
        body: input.body,
        inspectionId: input.inspectionId,
        attachments: input.attachments,
      });
      await refresh();
      return thread.id;
    },
    [refresh],
  );

  const sendReply = useCallback(
    async (
      threadId: string,
      body: string,
      attachments?: Array<{
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        contentBase64: string;
      }>,
    ) => {
      const optimistic: ThreadMessage = {
        id: `local-${Date.now()}`,
        from: 'You',
        body: body || attachments?.[0]?.fileName || 'Attachment',
        at: new Date().toISOString(),
        fromSelf: true,
        attachments: attachments?.map((file) => ({ name: file.fileName, url: '' })),
      };
      setThreadMessages((current) => ({
        ...current,
        [threadId]: [...(current[threadId] ?? []), optimistic],
      }));
      setMessages((current) =>
        current.map((item) =>
          item.id === threadId
            ? { ...item, lastMessage: optimistic.body, lastAt: optimistic.at, unread: 0 }
            : item,
        ),
      );
      try {
        await replyInspectorMessage(threadId, { body, attachments });
        await refresh();
      } catch {
        // Keep the optimistic bubble if the reply request fails.
      }
    },
    [refresh],
  );

  const unreadMessages = useMemo(
    () => messages.reduce((sum, item) => sum + item.unread, 0),
    [messages],
  );
  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      messages,
      notifications,
      unreadMessages,
      unreadNotifications,
      loading,
      refreshing,
      error,
      refresh,
      getThreadMessages,
      markNotificationRead,
      createThread,
      sendReply,
    }),
    [
      messages,
      notifications,
      unreadMessages,
      unreadNotifications,
      loading,
      refreshing,
      error,
      refresh,
      getThreadMessages,
      markNotificationRead,
      createThread,
      sendReply,
    ],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used inside InboxProvider');
  return ctx;
}
