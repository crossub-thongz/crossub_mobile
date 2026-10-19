import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAccount } from '@/src/account/account-context';

/** Agency inspectors never see pool, payout, availability, or tribunal. */
export function useSelfManagedRedirect(): boolean {
  const { selfManaged, registrationResolved } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (registrationResolved && selfManaged) {
      router.replace('/');
    }
  }, [registrationResolved, selfManaged, router]);

  return registrationResolved && selfManaged;
}
