import type { InspectionType } from '@/src/lib/types';

export const jobDetail = (id: string) => `/jobs/${id}` as const;
export const jobHistory = (id: string) => `/jobs/${id}` as const;
export const jobKeys = (id: string, tab?: 'collect' | 'return') =>
  tab ? (`/jobs/${id}/keys?tab=${tab}` as const) : (`/jobs/${id}/keys` as const);
export const jobWorkflow = (id: string, type: InspectionType) =>
  `/jobs/${id}/${type}` as const;
export const jobAreas = (id: string, type: InspectionType) =>
  `/jobs/${id}/${type}?view=areas` as const;
export const jobInspect = (id: string, type: InspectionType) =>
  `/jobs/${id}/${type}?view=inspect` as const;
export const messagesPath = '/messages' as const;
export const notificationsPath = '/notifications' as const;
export const messageDetail = (id: string) => `/messages/${id}` as const;
export const openBatchPath = '/open-batch' as const;
export const profilePath = '/profile' as const;
export const registerPath = '/register' as const;
export const weeklyAvailabilityPath = '/weekly-availability' as const;
export const settingsPath = '/settings' as const;
export const changePasswordPath = '/change-password' as const;
export const helpPath = '/help' as const;
export const earningsPath = '/earnings' as const;
export const keyManagementPath = '/key-management' as const;
export const tribunalPath = '/tribunal' as const;
export const tribunalDetailPath = (id: string) => `/tribunal/${id}` as const;
