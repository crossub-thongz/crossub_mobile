type Navigator = {
  navigate: (href: never) => void;
};

const recent = new Map<string, number>();

function routePath(href: string): string {
  const path = href.split('?')[0].split('#')[0];
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

export function isCurrentRoute(pathname: string, href: string): boolean {
  return routePath(pathname) === routePath(href);
}

/** Open a screen once. A second tap while it is already open does nothing. */
export function openSingleton(router: Navigator, pathname: string, href: string) {
  if (isCurrentRoute(pathname, href)) return;
  const key = routePath(href);
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < 700) return;
  recent.set(key, now);
  router.navigate(href as never);
}
