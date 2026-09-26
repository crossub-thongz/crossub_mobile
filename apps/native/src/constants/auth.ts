export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

/**
 * Hard session ceiling from the moment of login, not idle time.
 * Photographing a property backgrounds the app, so an inactivity timer would
 * sign inspectors out mid-job. When this elapses the app syncs first, then
 * signs out. Local drafts and unsent photos stay on the phone.
 */
export const SESSION_MAX_MS = 24 * 60 * 60 * 1000;
export const SESSION_CHECK_MS = 60_000;
export const OFFLINE_FLUSH_TIMEOUT_MS = 45_000;

