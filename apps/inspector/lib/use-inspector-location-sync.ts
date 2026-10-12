'use client';

import { useEffect } from 'react';

import { readDeviceLocation, subscribeDeviceLocation } from '@/lib/use-device-position';

/**
 * Send the shared GPS fix to the inspector location API. The watcher itself
 * already waits 30 seconds or 50 metres, so this does not PATCH on every tick.
 * The subscription lives in an effect so a new fix does not re-render the provider.
 */
export function useInspectorLocationSync(
  enabled: boolean,
  onLocation: (latitude: number, longitude: number) => void | Promise<void>,
) {
  useEffect(() => {
    if (!enabled) return;
    let lastKey = '';
    const send = () => {
      const position = readDeviceLocation();
      if (!position) return;
      const key = `${position.latitude.toFixed(5)},${position.longitude.toFixed(5)}`;
      if (lastKey === key) return;
      lastKey = key;
      void onLocation(position.latitude, position.longitude);
    };
    send();
    return subscribeDeviceLocation(send);
  }, [enabled, onLocation]);
}
