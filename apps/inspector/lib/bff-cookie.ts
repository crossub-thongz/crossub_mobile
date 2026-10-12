/**
 * Rewrite upstream auth Set-Cookie headers for the Next.js BFF proxy.
 *
 * Staging/production Nest emits `Secure; SameSite=None` (and sometimes a
 * `Domain=` the browser host cannot use). Local dev runs on http://localhost
 * where `Secure` cookies are dropped.
 */
export function rewriteBffSetCookie(cookie: string, requestHost: string): string {
  const isLocalHost =
    requestHost.includes('localhost') ||
    requestHost.startsWith('127.0.0.1') ||
    requestHost.endsWith('.local');

  const parts = cookie.split(';').map((p) => p.trim());
  const nameValue = parts[0] ?? '';
  const attrs = parts.slice(1).filter((part) => {
    const lower = part.toLowerCase();
    if (lower.startsWith('domain=')) return false;
    if (lower.startsWith('samesite=')) return false;
    if (lower === 'secure') return false;
    return part.length > 0;
  });

  attrs.push('SameSite=Lax');
  if (!isLocalHost) {
    attrs.push('Secure');
  }

  return [nameValue, ...attrs].join('; ');
}

/** Collect all Set-Cookie headers from an upstream fetch Response. */
export function readUpstreamSetCookies(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') {
    const cookies = headers.getSetCookie();
    if (cookies.length > 0) return cookies;
  }

  const single = headers.get('set-cookie');
  return single ? [single] : [];
}
