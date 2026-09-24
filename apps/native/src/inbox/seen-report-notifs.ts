import * as SecureStore from 'expo-secure-store';

const KEY = 'csb_seen_report_notifs';
const MAX_IDS = 200;

const memory = new Set<string>();
let hydrated = false;

async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return;
    const ids = JSON.parse(raw) as unknown;
    if (!Array.isArray(ids)) return;
    for (const id of ids) {
      if (typeof id === 'string') memory.add(id);
    }
  } catch {
    // ignore
  }
}

async function persist(): Promise<void> {
  const ids = [...memory].slice(-MAX_IDS);
  memory.clear();
  for (const id of ids) memory.add(id);
  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export async function loadSeenReportNotificationIds(): Promise<Set<string>> {
  await hydrate();
  return new Set(memory);
}

export async function markReportNotificationsSeen(ids: string[]): Promise<void> {
  await hydrate();
  for (const id of ids) memory.add(id);
  await persist();
}
