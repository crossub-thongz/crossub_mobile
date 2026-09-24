import { apiErrorMessage, crossub } from '@/src/api/client';

type DevicePlatform = 'IOS' | 'ANDROID' | 'WEB';

function throwIfFailed(
  error: unknown,
  response: { status: number },
  fallback: string,
): never {
  if (response.status === 401) {
    throw new Error('Session expired. Sign out and sign in again.');
  }
  throw new Error(apiErrorMessage(error, fallback));
}

/** Register this device for inspector push (`POST /me/device-tokens`). */
export async function registerDeviceToken(
  token: string,
  platform: DevicePlatform,
): Promise<void> {
  const { error, response } = await crossub.POST('/me/device-tokens', {
    body: { token, platform },
  });
  if (error) throwIfFailed(error, response, 'Could not register this device for notifications.');
}

/** Drop this device token (`DELETE /me/device-tokens`). */
export async function unregisterDeviceToken(token: string): Promise<void> {
  const { error, response } = await crossub.DELETE('/me/device-tokens', {
    body: { token },
  });
  if (error) throwIfFailed(error, response, 'Could not unregister this device.');
}
