import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

import { setInspectorLocation } from '@/src/api/inspector';
import type { GeoPoint } from '@/src/lib/travel';

const PING_MIN_MS = 30_000;

export function useDeviceLocation(options?: {
  enabled?: boolean;
  pingServer?: boolean;
}): GeoPoint | null {
  const enabled = options?.enabled ?? true;
  const pingServer = options?.pingServer ?? false;
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const lastPing = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    const apply = (coords: { latitude: number; longitude: number }) => {
      if (cancelled) return;
      const next = { latitude: coords.latitude, longitude: coords.longitude };
      setPosition(next);
      if (!pingServer) return;
      const now = Date.now();
      if (now - lastPing.current < PING_MIN_MS) return;
      lastPing.current = now;
      void setInspectorLocation(next.latitude, next.longitude).catch(() => undefined);
    };

    void (async () => {
      try {
        const current = await Location.getForegroundPermissionsAsync();
        let status = current.status;
        if (status !== Location.PermissionStatus.GRANTED) {
          const asked = await Location.requestForegroundPermissionsAsync();
          status = asked.status;
        }
        if (cancelled || status !== Location.PermissionStatus.GRANTED) return;

        const last = await Location.getLastKnownPositionAsync();
        if (cancelled) return;
        if (last) apply(last.coords);
        let fresh: Location.LocationObject | null = null;
        try {
          fresh = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
        } catch {
          fresh = null;
        }
        if (cancelled) return;
        if (fresh) apply(fresh.coords);

        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 50,
            timeInterval: 30_000,
          },
          (loc) => apply(loc.coords),
        );
        if (cancelled) {
          watcher.remove();
          return;
        }
        subscription = watcher;
      } catch {
        // Location is unavailable. The screen still works without a pin.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled, pingServer]);

  return position;
}
