import { AuthProvider } from '@/src/auth/auth-context';
import { AuthGate } from '@/src/auth/auth-gate';
import { OfflineProvider } from '@/src/offline/offline-context';

export default function RootLayout() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <AuthGate />
      </OfflineProvider>
    </AuthProvider>
  );
}
