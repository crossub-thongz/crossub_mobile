import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Gap under the last row, added on top of the home-indicator inset. */
const SCROLL_END_GAP = 16;

/**
 * Bottom padding for a screen that is not already inside a bottom safe area
 * (the tab bar, or a parent SafeAreaView). Keeps the last row above the
 * home indicator on the current device.
 */
export function useScrollEndPadding(): number {
  const { bottom } = useSafeAreaInsets();
  return bottom + SCROLL_END_GAP;
}

/** Pro Max class screens. The home indicator sits further from a one-handed thumb. */
const TALL_PHONE_HEIGHT = 900;

/** Extra space above the home indicator so the tab bar and shutter sit in thumb reach. */
export const THUMB_REACH_LIFT = 28;

export function useThumbReachLift(): number {
  const { height } = useWindowDimensions();
  return height >= TALL_PHONE_HEIGHT ? THUMB_REACH_LIFT : 0;
}
