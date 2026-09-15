import * as SQLite from 'expo-sqlite';

import type { RoutineExecutionDraft } from '@/src/lib/types';

const DB_NAME = 'crossub-inspector.db';

export const OFFLINE_QUEUE_MAX_ITEMS = 200;

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
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

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
      return db;
    })();
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
    message.includes('internet')
  );
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

export async function enqueueOfflineAction(
  jobId: string,
  action: OfflineAction,
  payload: Record<string, unknown>,
): Promise<OfflineQueueItem> {
  const db = await getDb();
  const item: OfflineQueueItem = {
    id: `oq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    jobId,
    action,
    payload,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    `INSERT INTO queue (id, job_id, action, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    item.id,
    item.jobId,
    item.action,
    JSON.stringify(item.payload),
    item.createdAt,
  );
  const countRow = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM queue`);
  const extra = (countRow?.count ?? 0) - OFFLINE_QUEUE_MAX_ITEMS;
  if (extra > 0) {
    await db.runAsync(
      `DELETE FROM queue WHERE id IN (SELECT id FROM queue ORDER BY created_at ASC LIMIT ?)`,
      extra,
    );
  }
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
  }>(`SELECT id, job_id, action, payload, created_at FROM queue ORDER BY created_at ASC`);
  return rows.map((row) => ({
    id: row.id,
    jobId: row.job_id,
    action: row.action as OfflineAction,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    createdAt: row.created_at,
  }));
}

export async function pendingSyncCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM queue`);
  return row?.count ?? 0;
}

export async function removeQueueItem(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM queue WHERE id = ?`, id);
}
