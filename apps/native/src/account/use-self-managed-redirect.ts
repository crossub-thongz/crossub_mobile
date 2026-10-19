import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAccount } from '@/src/account/account-context';

/** Self-Manage inspectors have no Task Pool or Tribunal. Send those routes to Inspect. */
export function useSelfManagedRedirect(): boolean {
  const { selfManaged, registrationResolved } = useAccount();
  const router = useRouter();

  useEffect(() => {
    if (registrationResolved && selfManaged) {
      router.replace('/inspect');
    }
  }, [registrationResolved, selfManaged, router]);

  return registrationResolved && selfManaged;
}
