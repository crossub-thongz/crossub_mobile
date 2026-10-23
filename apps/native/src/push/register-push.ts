import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { registerDeviceToken, unregisterDeviceToken } from '@/src/api/me';

const TOKEN_KEY = 'csb_push_token';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Expo Go on Android throws as soon as expo-notifications is imported.
 * A development or store build still loads it.
 */
function loadNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android' && Constants.executionEnvironment === 'storeClient') return null;
  try {
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

const Notifications = loadNotifications();

export function deviceNotifications(): NotificationsModule | null {
  return Notifications;
}

if (Notifications) {
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
  if (!Notifications) return;
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
