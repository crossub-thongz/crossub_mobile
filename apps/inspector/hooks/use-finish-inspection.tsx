'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { InspectionCompleteOverlay } from '@/components/inspector/inspection-complete-overlay';
import { useInspectorData } from '@/components/providers/inspector-data-provider';
import { ROUTES, jobKeys } from '@/constants/routes';

type OverlayState = {
  title: string;
  subtitle?: string;
  redirect: 'home' | 'keys';
};

const POST_FINISH_DELAY_MS = 2400;

export function useFinishInspection(jobId: string) {
  const { finishInspectionWorkflow } = useInspectorData();
  const [overlay, setOverlay] = useState<OverlayState | null>(null);
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const pendingRedirectRef = useRef<OverlayState['redirect'] | null>(null);
  const navigationTimerRef = useRef<number | null>(null);

  const navigateToNextStep = useCallback(
    (redirect: OverlayState['redirect']) => {
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
        navigationTimerRef.current = null;
      }
      pendingRedirectRef.current = null;
      setOverlay(null);
      const url =
        redirect === 'keys' ? jobKeys(jobId, 'return') : ROUTES.DASHBOARD;
      // Hard navigation — soft router.replace can no-op when a latched gate already
      // attempted the same route, leaving the celebration overlay stuck on screen.
      window.location.assign(url);
    },
    [jobId],
  );

  const dismissOverlay = useCallback(() => {
    const redirect =
      pendingRedirectRef.current ?? overlayRef.current?.redirect ?? null;
    if (!redirect) return;
    navigateToNextStep(redirect);
  }, [navigateToNextStep]);

  const scheduleNavigation = useCallback(
    (redirect: OverlayState['redirect']) => {
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
      navigationTimerRef.current = window.setTimeout(() => {
        navigationTimerRef.current = null;
        navigateToNextStep(redirect);
      }, POST_FINISH_DELAY_MS);
    },
    [navigateToNextStep],
  );

  useEffect(
    () => () => {
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
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

  const finish = useCallback(
    (successMessage: string, title = 'Inspection complete') => {
      const outcome = finishInspectionWorkflow(jobId);

      if (outcome === 'needs_key_return') {
        celebrate(
          'Return the keys to complete this task.',
          'keys',
          'Report generated',
        );
        return;
      }

      celebrate(successMessage, 'home', title);
    },
    [jobId, finishInspectionWorkflow, celebrate],
  );

  const Celebration = (
    <InspectionCompleteOverlay
      open={overlay != null}
      title={overlay?.title ?? ''}
      subtitle={overlay?.subtitle}
      onDone={dismissOverlay}
    />
  );

  return { finish, celebrate, Celebration };
}
