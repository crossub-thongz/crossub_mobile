import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { registerDeviceToken, unregisterDeviceToken } from '@/src/api/me';

const TOKEN_KEY = 'csb_push_token';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

function easProjectId(): string | undefined {
  return (
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas
      ?.projectId
  );
}

export async function registerInspectorPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('report-decisions', {
      name: 'Report decisions',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const projectId = easProjectId();
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerDeviceToken(token, Platform.OS === 'ios' ? 'IOS' : 'ANDROID');
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Token is still registered on the server.
  }
}

export async function unregisterInspectorPush(): Promise<void> {
  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    token = null;
  }
  if (!token) return;
  try {
    await unregisterDeviceToken(token);
  } catch {
    // Still sign out if unregister fails.
  }
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // ignore
  }
}
