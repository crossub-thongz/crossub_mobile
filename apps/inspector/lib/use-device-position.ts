'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { haversineKm, type GeoPoint } from '@/lib/travel';

const PUBLISH_MS = 30_000;
const PUBLISH_MOVE_KM = 0.05;

let current: GeoPoint | null = null;
let lastPublishedAt = 0;
const listeners = new Set<() => void>();

function publish(next: GeoPoint) {
  const now = Date.now();
  if (current) {
    const moved = haversineKm(
      current.latitude,
      current.longitude,
      next.latitude,
      next.longitude,
    );
    if (moved < PUBLISH_MOVE_KM && now - lastPublishedAt < PUBLISH_MS) return;
  }
  current = next;
  lastPublishedAt = now;
  for (const listener of listeners) listener();
}

export function subscribeDeviceLocation(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readDeviceLocation(): GeoPoint | null {
  return current;
}

/** Latest GPS fix. Updates at most every 30 seconds, or sooner after a 50 metre move. */
export function useDeviceLocation(): GeoPoint | null {
  return useSyncExternalStore(subscribeDeviceLocation, () => current, () => null);
}

/**
 * One geolocation watcher for the whole website. Screens read the fix with
 * useDeviceLocation instead of starting a second watch.
 */
export function usePublishDevicePosition(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    let watchId: number | null = null;
    const onFix = (pos: GeolocationPosition) => {
      publish({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    };

    navigator.geolocation.getCurrentPosition(onFix, () => undefined, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: 15_000,
    });
    watchId = navigator.geolocation.watchPosition(onFix, () => undefined, {
      enableHighAccuracy: true,
      maximumAge: 30_000,
      timeout: 20_000,
    });

    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
  }, [enabled]);
}
