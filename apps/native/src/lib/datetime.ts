export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function startOfLocalDay(from = new Date()): Date {
  const day = new Date(from);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function formatInspectTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\b(am|pm)\b/gi, (part) => part.toUpperCase());
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatScheduleWhen(iso: string): string {
  const time = formatInspectTime(iso);
  if (isToday(iso)) return `Today, ${time}`;
  return `${formatDate(iso)}, ${time}`;
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-AU')}`;
}

export function formatInspectDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '-';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  const rounded = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${rounded} hrs`;
}

export function greetingForNow(from = new Date()): string {
  const hour = from.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatLongDate(from = new Date()): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(from);
}

export function isThisWeek(iso: string): boolean {
  const d = new Date(iso).getTime();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return d >= weekAgo;
}

export function displayName(user: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || 'Inspector';
}

export function headerBadge(role?: string | null, accessLevel = 1): string {
  if (role === 'SUPER_ADMIN') return 'Admin';
  if (role === 'HR') return 'HR';
  return `Level ${accessLevel}`;
}

export function personInitials(person: {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  email?: string | null;
}): string {
  const first = person.firstName?.trim() ?? '';
  const last = person.lastName?.trim() ?? '';
  if (first && last) return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  const tokens = (person.fullName?.trim() || `${first} ${last}`.trim())
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0].charAt(0)}${tokens[tokens.length - 1].charAt(0)}`.toUpperCase();
  }
  if (tokens.length === 1 && tokens[0].length >= 2) return tokens[0].slice(0, 2).toUpperCase();
  const local = person.email?.split('@')[0]?.replace(/[^a-zA-Z]/g, '') ?? '';
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return '?';
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  const day = new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\b(am|pm)\b/gi, (part) => part.toLowerCase());
  return `${day}, ${time}`;
}
