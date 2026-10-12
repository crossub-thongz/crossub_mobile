import { AuthProvider } from '@/src/auth/auth-context';
import { AuthGate } from '@/src/auth/auth-gate';
import { OfflineProvider } from '@/src/offline/offline-context';
import { AppErrorBoundary } from '@/src/ui/app-error-boundary';

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <OfflineProvider>
          <AuthGate />
        </OfflineProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}
