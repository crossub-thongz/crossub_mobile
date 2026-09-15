import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAccount } from '@/src/account/account-context';
import { useAuth } from '@/src/auth/auth-context';
import {
  needsPasswordChange,
  needsSystemAccessAgreement,
} from '@/src/lib/system-access-agreement';
import {
  changePasswordPath,
  profilePath,
  registerPath,
  systemAccessAgreementPath,
} from '@/src/lib/routes';

const EXEMPT = [
  systemAccessAgreementPath,
  registerPath,
  profilePath,
  changePasswordPath,
] as const;

function isExempt(pathname: string): boolean {
  return EXEMPT.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function OnboardingGate() {
  const { user, status } = useAuth();
  const { registrationComplete, loading } = useAccount();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (status !== 'authed' || !user || loading || isExempt(pathname)) return;
    if (!registrationComplete) {
      router.replace(registerPath);
      return;
    }
    if (needsSystemAccessAgreement(user)) {
      router.replace(systemAccessAgreementPath);
      return;
    }
    if (needsPasswordChange(user)) {
      router.replace(changePasswordPath);
    }
  }, [status, user, loading, registrationComplete, pathname, router]);

  return null;
}
