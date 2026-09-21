import * as SQLite from 'expo-sqlite';

import type { RoutineExecutionDraft } from '@/src/lib/types';
import { deleteQueuedPhoto, stripBase64Payload } from '@/src/offline/queued-photo';

const DB_NAME = 'crossub-inspector.db';

export const OFFLINE_QUEUE_MAX_ITEMS = 2000;

export type OfflineAction =
  | 'execution_draft'
  | 'findings'
  | 'photo_upload'
  | 'key_custody'
  | 'key_photo';

export type OfflineQueueItem = {
  id: string;
  jobId: string;
  action: OfflineAction;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
};

const queueListeners = new Set<() => void>();

export function subscribeQueueChanged(listener: () => void): () => void {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

function notifyQueueChanged(): void {
  for (const listener of queueListeners) listener();
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrateQueue(db: SQLite.SQLiteDatabase): Promise<void> {
  const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(queue)`);
  if (!cols.some((col) => col.name === 'attempts')) {
    await db.execAsync(`ALTER TABLE queue ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0`);
  }
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS drafts (
          inspection_id TEXT PRIMARY KEY NOT NULL,
          json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS queue (
          id TEXT PRIMARY KEY NOT NULL,
          job_id TEXT NOT NULL,
          action TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
      await migrateQueue(db);
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export function isRetryableNetworkError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    err instanceof TypeError ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('could not reach') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('offline') ||
    message.includes('internet') ||
    message.includes('session expired') ||
    message.includes('sign in again') ||
    message.includes('econn') ||
    message.includes('socket') ||
    /\b(429|500|502|503|504)\b/.test(message)
  );
}

export function isAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return message.includes('session expired') || message.includes('sign in again');
}

export function isPermanentPhotoError(err: unknown): boolean {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return message.includes('too large') || message.includes('could not encode');
}

export async function saveDraftLocal(
  inspectionId: string,
  draft: RoutineExecutionDraft,
): Promise<void> {
  const db = await getDb();
  const updatedAt = draft.updatedAt ?? new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO drafts (inspection_id, json, updated_at) VALUES (?, ?, ?)`,
    inspectionId,
    JSON.stringify(draft),
    updatedAt,
  );
}

export async function loadAllDrafts(): Promise<Record<string, RoutineExecutionDraft>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ inspection_id: string; json: string }>(
    `SELECT inspection_id, json FROM drafts`,
  );
  const next: Record<string, RoutineExecutionDraft> = {};
  for (const row of rows) {
    try {
      next[row.inspection_id] = JSON.parse(row.json) as RoutineExecutionDraft;
    } catch {
      // Skip a corrupt row rather than blocking the rest of the cache.
    }
  }
  return next;
}

export async function deleteDraftLocal(inspectionId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM drafts WHERE inspection_id = ?`, inspectionId);
}

async function parsePayload(raw: string): Promise<Record<string, unknown> | null> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

async function trimOldest(db: SQLite.SQLiteDatabase, extra: number): Promise<void> {
  const doomed = await db.getAllAsync<{ id: string; payload: string }>(
    `SELECT id, payload FROM queue ORDER BY created_at ASC LIMIT ?`,
    extra,
  );
  for (const row of doomed) {
    const payload = await parsePayload(row.payload);
    const uri = typeof payload?.localUri === 'string' ? payload.localUri : undefined;
    await deleteQueuedPhoto(uri);
    await db.runAsync(`DELETE FROM queue WHERE id = ?`, row.id);
  }
}

export async function deleteMatchingQueueItems(
  jobId: string,
  action: OfflineAction,
  phase?: string,
): Promise<void> {
  const db = await getDb();
  if (phase) {
    await db.runAsync(
      `DELETE FROM queue WHERE job_id = ? AND action = ? AND json_extract(payload, '$.phase') = ?`,
      jobId,
      action,
      phase,
    );
  } else {
    await db.runAsync(`DELETE FROM queue WHERE job_id = ? AND action = ?`, jobId, action);
  }
}

export async function replaceOfflineAction(
  jobId: string,
  action: OfflineAction,
  payload: Record<string, unknown>,
  phase?: string,
): Promise<OfflineQueueItem> {
  await deleteMatchingQueueItems(jobId, action, phase);
  return enqueueOfflineAction(jobId, action, payload);
}

export async function enqueueOfflineAction(
  jobId: string,
  action: OfflineAction,
  payload: Record<string, unknown>,
): Promise<OfflineQueueItem> {
  const db = await getDb();
  const safePayload = stripBase64Payload(payload);
  const item: OfflineQueueItem = {
    id: `oq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    jobId,
    action,
    payload: safePayload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await db.runAsync(
    `INSERT INTO queue (id, job_id, action, payload, created_at, attempts) VALUES (?, ?, ?, ?, ?, 0)`,
    item.id,
    item.jobId,
    item.action,
    JSON.stringify(item.payload),
    item.createdAt,
  );
  const countRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM queue`);
  const extra = (countRow?.count ?? 0) - OFFLINE_QUEUE_MAX_ITEMS;
  if (extra > 0) await trimOldest(db, extra);
  notifyQueueChanged();
  return item;
}

export async function loadOfflineQueue(): Promise<OfflineQueueItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    job_id: string;
    action: string;
    payload: string;
    created_at: string;
    attempts: number | null;
  }>(`SELECT id, job_id, action, payload, created_at, attempts FROM queue ORDER BY created_at ASC`);
  const items: OfflineQueueItem[] = [];
  for (const row of rows) {
    const payload = await parsePayload(row.payload);
    if (!payload) {
      await db.runAsync(`DELETE FROM queue WHERE id = ?`, row.id);
      continue;
    }
    items.push({
      id: row.id,
      jobId: row.job_id,
      action: row.action as OfflineAction,
      payload,
      createdAt: row.created_at,
      attempts: row.attempts ?? 0,
    });
  }
  return items;
}

export async function pendingSyncCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM queue`);
  return row?.count ?? 0;
}

export async function removeQueueItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM queue WHERE id = ?`, id);
  notifyQueueChanged();
}

export async function bumpQueueAttempt(id: string): Promise<number> {
  const db = await getDb();
  await db.runAsync(`UPDATE queue SET attempts = attempts + 1 WHERE id = ?`, id);
  const row = await db.getFirstAsync<{ attempts: number }>(
    `SELECT attempts FROM queue WHERE id = ?`,
    id,
  );
  notifyQueueChanged();
  return row?.attempts ?? 1;
}

export async function updateQueuePayload(
  id: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE queue SET payload = ? WHERE id = ?`,
    JSON.stringify(stripBase64Payload(payload)),
    id,
  );
}

export function rewriteStrings(
  value: unknown,
  from: string,
  to: string,
): unknown {
  if (from.length === 0 || from === to) return value;
  if (value === from) return to;
  if (typeof value === 'string' && value.includes(from)) return value.split(from).join(to);
  if (Array.isArray(value)) return value.map((item) => rewriteStrings(item, from, to));
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      next[key] = rewriteStrings(nested, from, to);
    }
    return next;
  }
  return value;
}

export async function rewriteQueuedUris(from: string, to: string): Promise<void> {
  if (!from || from === to) return;
  const items = await loadOfflineQueue();
  for (const item of items) {
    const next = rewriteStrings(item.payload, from, to) as Record<string, unknown>;
    if (JSON.stringify(next) !== JSON.stringify(item.payload)) {
      await updateQueuePayload(item.id, next);
    }
  }
}
