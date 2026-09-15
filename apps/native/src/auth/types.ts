export const PASSWORD_MAX = 128;

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  status: string;
  profileCompleted?: boolean;
  firstName?: string | null;
  lastName?: string | null;
  mustChangePassword?: boolean;
  mustChangePasswordWithoutCurrent?: boolean;
  systemAccessAgreementRequired?: boolean;
  systemAccessAccepted?: boolean;
  inspectorPortalAgreementAccepted?: boolean;
};

function optionalBool(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function parseAuthUser(value: unknown): AuthUser | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.email !== 'string') return null;
  return {
    id: record.id,
    email: record.email,
    role: typeof record.role === 'string' ? record.role : '',
    status: typeof record.status === 'string' ? record.status : '',
    profileCompleted: optionalBool(record.profileCompleted),
    firstName: typeof record.firstName === 'string' ? record.firstName : null,
    lastName: typeof record.lastName === 'string' ? record.lastName : null,
    mustChangePassword: optionalBool(record.mustChangePassword),
    mustChangePasswordWithoutCurrent: optionalBool(record.mustChangePasswordWithoutCurrent),
    systemAccessAgreementRequired: optionalBool(record.systemAccessAgreementRequired),
    systemAccessAccepted: optionalBool(record.systemAccessAccepted),
    inspectorPortalAgreementAccepted: optionalBool(record.inspectorPortalAgreementAccepted),
  };
}
