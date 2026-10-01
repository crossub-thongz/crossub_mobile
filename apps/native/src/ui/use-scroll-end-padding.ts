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
