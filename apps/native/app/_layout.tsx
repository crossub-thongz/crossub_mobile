import { AuthProvider } from '@/src/auth/auth-context';
import { AuthGate } from '@/src/auth/auth-gate';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
