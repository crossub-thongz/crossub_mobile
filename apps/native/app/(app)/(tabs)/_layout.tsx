import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccount } from '@/src/account/account-context';
import { useInspections } from '@/src/inspections/inspections-context';
import { inspectorLevelAllows } from '@/src/lib/inspector-access-level';
import { colors } from '@/src/theme';
import { useThumbReachLift } from '@/src/ui/use-scroll-end-padding';

const TAB_BAR_HEIGHT = 49;

export default function TabsLayout() {
  const { pool, todaysJobs } = useInspections();
  const { accessLevel, selfManaged, registrationResolved } = useAccount();
  const showTribunal =
    registrationResolved && !selfManaged && inspectorLevelAllows(accessLevel, 'tribunal');
  const showPool = registrationResolved && !selfManaged;
  const insets = useSafeAreaInsets();
  const thumbLift = useThumbReachLift();
  const tabBarPadding = insets.bottom + thumbLift;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: TAB_BAR_HEIGHT + tabBarPadding,
          paddingBottom: tabBarPadding,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        tabBarBadgeStyle: {
          backgroundColor: colors.destructive,
          color: '#fff',
          fontSize: 9,
          minWidth: 16,
          height: 16,
          lineHeight: 16,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="pool"
        options={{
          href: showPool ? undefined : null,
          title: 'Pool',
          tabBarBadge: pool.length > 0 ? pool.length : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'briefcase' : 'briefcase-outline'} color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="inspect"
        options={{
          title: 'Inspect',
          tabBarAccessibilityLabel: selfManaged ? 'Inspect (Self-Manage)' : 'Inspect',
          tabBarBadge: todaysJobs.length > 0 ? todaysJobs.length : undefined,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="tribunal"
        options={{
          href: showTribunal ? undefined : null,
          title: 'Tribunal',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'scale' : 'scale-outline'} color={color} size={20} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'}
              color={color}
              size={20}
            />
          ),
        }}
      />
    </Tabs>
  );
}
