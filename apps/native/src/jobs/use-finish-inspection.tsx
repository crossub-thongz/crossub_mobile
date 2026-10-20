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
  beginSubmit: () => void;
  cancelSubmit: () => void;
  celebrate: (
    successMessage: string,
    redirect?: OverlayState['redirect'],
    title?: string,
    after?: () => void,
  ) => void;
  celebrating: boolean;
  Celebration: ReactNode;
} {
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const pendingRedirectRef = useRef<OverlayState['redirect'] | null>(null);
  const afterRef = useRef<(() => void) | null>(null);
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
    const after = afterRef.current;
    afterRef.current = null;
    after?.();
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

  const beginSubmit = useCallback(() => {
    setSubmitting(true);
  }, []);

  const cancelSubmit = useCallback(() => {
    setSubmitting(false);
  }, []);

  const celebrate = useCallback(
    (
      successMessage: string,
      redirect: OverlayState['redirect'] = 'home',
      title = 'Inspection complete',
      after?: () => void,
    ) => {
      afterRef.current = after ?? null;
      pendingRedirectRef.current = redirect;
      setSubmitting(false);
      setOverlay({ title, subtitle: successMessage, redirect });
      scheduleNavigation(redirect);
    },
    [scheduleNavigation],
  );

  const Celebration = useMemo(
    () => (
      <InspectionCompleteOverlay
        open={overlay != null}
        submitting={submitting && overlay == null}
        title={overlay?.title ?? ''}
        subtitle={overlay?.subtitle}
        onDone={dismissOverlay}
      />
    ),
    [overlay, submitting, dismissOverlay],
  );

  return {
    beginSubmit,
    cancelSubmit,
    celebrate,
    celebrating: overlay != null || submitting,
    Celebration,
  };
}
