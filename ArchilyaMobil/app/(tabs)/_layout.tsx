import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Bell, Folder, LayoutDashboard, Wand2 } from 'lucide-react-native';
import { useInvitations } from '../../src/hooks/useInvitations';
import { useNotifications } from '../../src/hooks/useNotifications';
import { useWorkspace } from '../../src/hooks/useWorkspace';

export default function TabLayout() {
  const { t } = useTranslation();
  const { unreadCount } = useNotifications();
  const { receivedInvites } = useInvitations();
  const { workspaceInvites } = useWorkspace();
  const inboxBadgeCount = (unreadCount || 0) + (receivedInvites?.length || 0) + (workspaceInvites?.length || 0);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#c6a87c',
        tabBarInactiveTintColor: '#4b5563',
        tabBarStyle: {
          backgroundColor: '#1a1c23',
          borderTopWidth: 1,
          borderTopColor: '#2a2d36',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('panel'),
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: t('projects'),
          tabBarIcon: ({ color, size }) => <Folder size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t('inbox'),
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
          tabBarBadge: inboxBadgeCount > 0 ? (inboxBadgeCount > 99 ? '99+' : inboxBadgeCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#c6a87c',
            color: '#0f1115',
            fontWeight: '700',
          },
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: t('aiStudio'),
          tabBarIcon: ({ color, size }) => <Wand2 size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
