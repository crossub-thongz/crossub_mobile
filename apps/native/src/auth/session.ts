import * as SecureStore from 'expo-secure-store';

import { parseAuthUser, type AuthUser } from '@/src/auth/types';

const ACCESS_KEY = 'csb_access_token';
const REFRESH_KEY = 'csb_refresh_token';
const USER_KEY = 'csb_auth_user';
const DEVICE_KEY = 'csb_device_id';
const SESSION_STARTED_KEY = 'csb_session_started_at';

const memory = new Map<string, string>();

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
};

async function read(key: string): Promise<string | null> {
  try {
    const value = await SecureStore.getItemAsync(key);
    if (value != null) return value;
    return memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

async function write(key: string, value: string): Promise<void> {
  memory.set(key, value);
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Expo web: keep the in-memory copy if SecureStore is unavailable.
  }
}

async function remove(key: string): Promise<void> {
  memory.delete(key);
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

export async function getAccessToken(): Promise<string | null> {
  return read(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return read(REFRESH_KEY);
}

export async function loadStoredUser(): Promise<AuthUser | null> {
  const raw = await read(USER_KEY);
  if (!raw) return null;
  try {
    return parseAuthUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveUser(user: AuthUser): Promise<void> {
  await write(USER_KEY, JSON.stringify(user));
}

export async function saveSession(
  tokens: SessionTokens,
  user: AuthUser | null,
): Promise<void> {
  await write(ACCESS_KEY, tokens.accessToken);
  await write(REFRESH_KEY, tokens.refreshToken);
  if (user) await write(USER_KEY, JSON.stringify(user));
  else await remove(USER_KEY);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    remove(ACCESS_KEY),
    remove(REFRESH_KEY),
    remove(USER_KEY),
    remove(SESSION_STARTED_KEY),
  ]);
}

export async function markSessionStarted(at = Date.now()): Promise<void> {
  await write(SESSION_STARTED_KEY, String(at));
}

export async function getSessionStartedAt(): Promise<number | null> {
  const raw = await read(SESSION_STARTED_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Stable per-install id for execution-draft overlays. Survives logout. */
export async function getDeviceId(): Promise<string> {
  const existing = await read(DEVICE_KEY);
  if (existing) return existing;
  const id = `native-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await write(DEVICE_KEY, id);
  return id;
}
