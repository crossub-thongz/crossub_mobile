export type MessageThread = {
  id: string;
  subject: string;
  participants: string[];
  lastMessage: string;
  lastAt: string;
  unread: number;
  category: 'agent' | 'inspection';
  inspectionId?: string | null;
  inspectionTrackingNumber?: string | null;
  propertyAddress?: string | null;
};

export type ThreadMessage = {
  id: string;
  from: string;
  body: string;
  at: string;
  fromSelf?: boolean;
  attachments?: { name: string; url: string }[];
};

export type InspectorNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
};

export function toNativeHref(href: string): string {
  if (!href) return '/';
  if (href.startsWith('/jobs/')) return href;
  if (href.startsWith('/messages')) return href;
  if (href.startsWith('/notifications')) return '/notifications';
  if (href.startsWith('/inspections')) return '/inspect';
  if (href.startsWith('/job-pool')) return '/pool';
  if (href.startsWith('/open-batch')) return '/open-batch';
  if (href.startsWith('/dashboard')) return '/';
  if (href.startsWith('/profile') || href.startsWith('/register')) return '/profile';
  if (href.startsWith('/weekly-availability')) return '/weekly-availability';
  if (href.startsWith('/settings') || href.startsWith('/change-password')) return '/settings';
  if (href.startsWith('/more')) return '/more';
  if (href.startsWith('/earnings')) return '/earnings';
  if (href.startsWith('/key-management')) return '/key-management';
  if (href.startsWith('/tribunal')) return href;
  return href;
}

export function mapMessageThreads(
  dtos: Array<{
    id: string;
    subject: string;
    participants: string[];
    lastMessage: string | null;
    lastAt: string | null;
    unread: number;
    inspectionId: string | null;
    inspectionTrackingNumber: string | null;
    propertyAddress: string | null;
    messages: Array<{
      id: string;
      from: string;
      body: string;
      at: string;
      fromSelf: boolean;
      attachments?: Array<{ fileName?: string; url?: string }>;
    }>;
  }>,
): { threads: MessageThread[]; messagesByThread: Record<string, ThreadMessage[]> } {
  const threads = dtos.map((dto) => ({
    id: dto.id,
    subject: dto.subject,
    participants: dto.participants,
    lastMessage: dto.lastMessage ?? '',
    lastAt: dto.lastAt ?? '',
    unread: dto.unread ?? 0,
    category: dto.inspectionId ? ('inspection' as const) : ('agent' as const),
    inspectionId: dto.inspectionId,
    inspectionTrackingNumber: dto.inspectionTrackingNumber,
    propertyAddress: dto.propertyAddress,
  }));
  const messagesByThread: Record<string, ThreadMessage[]> = {};
  for (const dto of dtos) {
    messagesByThread[dto.id] = dto.messages.map((m) => ({
      id: m.id,
      from: m.from,
      body: m.body,
      at: m.at,
      fromSelf: m.fromSelf,
      attachments: (m.attachments ?? [])
        .filter((a) => a.fileName || a.url)
        .map((a) => ({ name: a.fileName ?? 'Attachment', url: a.url ?? '' })),
    }));
  }
  return { threads, messagesByThread };
}

export function mapNotifications(
  dtos: Array<{
    id: string;
    type: string;
    title: string;
    body: string;
    href: string;
    read: boolean;
    at: string;
  }>,
): InspectorNotification[] {
  return dtos.map((dto) => ({
    id: dto.id,
    type: dto.type.toLowerCase(),
    title: dto.title,
    body: dto.body,
    href: toNativeHref(dto.href),
    read: dto.read,
    createdAt: dto.at,
  }));
}
