export type SystemAccessAgreementView = {
  agreementType: string;
  title: string;
  version: string;
  fileName: string;
  documentPath: string;
};

export const INSPECTOR_SAA_PORTAL_QUERY = 'portal=inspector';

export function needsSystemAccessAgreement(user: {
  systemAccessAgreementRequired?: boolean;
  systemAccessAccepted?: boolean;
  inspectorPortalAgreementAccepted?: boolean;
}): boolean {
  if (!user.systemAccessAgreementRequired) return false;
  if (user.inspectorPortalAgreementAccepted) return false;
  if (user.systemAccessAccepted) return false;
  return true;
}

export function needsPasswordChange(user: { mustChangePassword?: boolean }): boolean {
  return Boolean(user.mustChangePassword);
}

export function postAuthDestination(
  user: {
    systemAccessAgreementRequired?: boolean;
    systemAccessAccepted?: boolean;
    inspectorPortalAgreementAccepted?: boolean;
    mustChangePassword?: boolean;
  },
  defaultRoute: string,
  agreementRoute: string,
  changePasswordRoute = '/change-password',
): string {
  if (needsSystemAccessAgreement(user)) return agreementRoute;
  if (needsPasswordChange(user)) return changePasswordRoute;
  return defaultRoute;
}

export function postRegistrationDestination(
  user: {
    systemAccessAgreementRequired?: boolean;
    systemAccessAccepted?: boolean;
    inspectorPortalAgreementAccepted?: boolean;
  },
  dashboardRoute: string,
  agreementRoute: string,
): string {
  return needsSystemAccessAgreement(user) ? agreementRoute : dashboardRoute;
}
