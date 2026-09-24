import { Stack } from 'expo-router';
import { View } from 'react-native';

import { AccountProvider } from '@/src/account/account-context';
import { OnboardingGate } from '@/src/account/onboarding-gate';
import { LedgerProvider } from '@/src/account/ledger-context';
import { InboxProvider } from '@/src/inbox/inbox-context';
import { ReportDecisionAlerts } from '@/src/inbox/report-decision-alerts';
import { InspectionsProvider } from '@/src/inspections/inspections-context';
import { PoolUrgentAlerts } from '@/src/jobs/pool-urgent-alerts';
import { InspectorPushBridge } from '@/src/push/push-bridge';
import { colors } from '@/src/theme';

export default function AppLayout() {
  return (
    <InspectionsProvider>
      <AccountProvider>
        <OnboardingGate />
        <LedgerProvider>
          <InboxProvider>
            <View style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  headerStyle: { backgroundColor: colors.background },
                  headerTintColor: colors.text,
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="history" options={{ headerShown: false }} />
                <Stack.Screen name="jobs/[id]" options={{ headerShown: false }} />
                <Stack.Screen name="messages" options={{ headerShown: false }} />
                <Stack.Screen name="notifications" options={{ headerShown: false }} />
                <Stack.Screen name="open-batch" options={{ headerShown: false }} />
                <Stack.Screen name="profile" options={{ headerShown: false }} />
                <Stack.Screen name="register" options={{ headerShown: false }} />
                <Stack.Screen name="weekly-availability" options={{ headerShown: false }} />
                <Stack.Screen name="settings" options={{ headerShown: false }} />
                <Stack.Screen name="change-password" options={{ headerShown: false }} />
                <Stack.Screen name="help" options={{ headerShown: false }} />
                <Stack.Screen name="earnings" options={{ headerShown: false }} />
                <Stack.Screen name="key-management" options={{ headerShown: false }} />
                <Stack.Screen name="system-access-agreement" options={{ headerShown: false }} />
              </Stack>
              <PoolUrgentAlerts />
              <ReportDecisionAlerts />
              <InspectorPushBridge />
            </View>
          </InboxProvider>
        </LedgerProvider>
      </AccountProvider>
    </InspectionsProvider>
  );
}
