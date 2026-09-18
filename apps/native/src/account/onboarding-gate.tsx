import { usePathname, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

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
  const { registrationComplete, registrationResolved, loading } = useAccount();
  const pathname = usePathname();
  const router = useRouter();
  const leftOnboarding = useRef(false);

  useEffect(() => {
    if (status !== 'authed') {
      leftOnboarding.current = false;
      return;
    }
    if (!user || loading || !registrationResolved) return;

    if (!registrationComplete) {
      if (!isExempt(pathname)) router.replace(registerPath);
      return;
    }
    if (needsSystemAccessAgreement(user)) {
      if (pathname !== systemAccessAgreementPath) {
        router.replace(systemAccessAgreementPath);
      }
      return;
    }
    if (needsPasswordChange(user)) {
      if (pathname !== changePasswordPath) {
        router.replace(changePasswordPath);
      }
      return;
    }

    if (!leftOnboarding.current && pathname === registerPath) {
      leftOnboarding.current = true;
      router.replace('/');
      return;
    }
    leftOnboarding.current = true;
  }, [status, user, loading, registrationResolved, registrationComplete, pathname, router]);

  return null;
}
