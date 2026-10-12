import { COOKIE_ACCESS } from '@/constants/auth';

const ACCOUNTS_KEY = 'crossub_inspector_accounts';
const SESSION_KEY = 'crossub_inspector_session';
const LOCAL_ACCESS_VALUE = 'local-inspector';

/**
 * Older builds signed the browser in with a demo account whose password was
 * stored in localStorage, and accepted a cookie anyone could set
 * (`csb_at=local-inspector`) when `/auth/me` returned 401.
 * A real session comes only from the API. This wipes that leftover data.
 */
export function clearLocalSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCOUNTS_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  const hasFakeAccess = document.cookie.split(';').some((part) => {
    const [name, value] = part.trim().split('=');
    return name === COOKIE_ACCESS && value === LOCAL_ACCESS_VALUE;
  });
  if (hasFakeAccess) {
    document.cookie = `${COOKIE_ACCESS}=; path=/; max-age=0`;
  }
}
