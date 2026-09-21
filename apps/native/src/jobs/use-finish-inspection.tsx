import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { InspectionCompleteOverlay } from '@/src/jobs/inspection-complete-overlay';

type OverlayState = {
  title: string;
  subtitle?: string;
  redirect: 'home' | 'keys';
};

const POST_FINISH_DELAY_MS = 2400;

export function useFinishInspection({
  onHome,
  onKeys,
}: {
  onHome: () => void;
  onKeys: () => void;
}): {
  celebrate: (
    successMessage: string,
    redirect?: OverlayState['redirect'],
    title?: string,
  ) => void;
  celebrating: boolean;
  Celebration: ReactNode;
} {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const pendingRedirectRef = useRef<OverlayState['redirect'] | null>(null);
  const navigationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHomeRef = useRef(onHome);
  const onKeysRef = useRef(onKeys);
  onHomeRef.current = onHome;
  onKeysRef.current = onKeys;

  const navigateToNextStep = useCallback((redirect: OverlayState['redirect']) => {
    if (navigationTimerRef.current) {
      clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }
    pendingRedirectRef.current = null;
    setOverlay(null);
    if (redirect === 'keys') onKeysRef.current();
    else onHomeRef.current();
  }, []);

  const dismissOverlay = useCallback(() => {
    const redirect = pendingRedirectRef.current ?? overlayRef.current?.redirect ?? null;
    if (!redirect) return;
    navigateToNextStep(redirect);
  }, [navigateToNextStep]);

  const scheduleNavigation = useCallback(
    (redirect: OverlayState['redirect']) => {
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = setTimeout(() => {
        navigationTimerRef.current = null;
        navigateToNextStep(redirect);
      }, POST_FINISH_DELAY_MS);
    },
    [navigateToNextStep],
  );

  useEffect(
    () => () => {
      if (navigationTimerRef.current) clearTimeout(navigationTimerRef.current);
    },
    [],
  );

  const celebrate = useCallback(
    (
      successMessage: string,
      redirect: OverlayState['redirect'] = 'home',
      title = 'Inspection complete',
    ) => {
      pendingRedirectRef.current = redirect;
      setOverlay({ title, subtitle: successMessage, redirect });
      scheduleNavigation(redirect);
    },
    [scheduleNavigation],
  );

  const Celebration = useMemo(
    () => (
      <InspectionCompleteOverlay
        open={overlay != null}
        title={overlay?.title ?? ''}
        subtitle={overlay?.subtitle}
        onDone={dismissOverlay}
      />
    ),
    [overlay, dismissOverlay],
  );

  return { celebrate, celebrating: overlay != null, Celebration };
}
