import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Search, Sparkles } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useProjects } from '../../src/hooks/useProjects';
import { useCredits } from '../../src/hooks/useCredits';
import { useNotifications } from '../../src/hooks/useNotifications';
import { useInvitations } from '../../src/hooks/useInvitations';
import SearchModal from '../../src/components/SearchModal';
import ProjectCreateModal from '../../src/components/ProjectCreateModal';
import StatsCards from '../../src/components/dashboard/StatsCards';
import QuickActionsGrid from '../../src/components/dashboard/QuickActionsGrid';
import RecentProjectsList from '../../src/components/dashboard/RecentProjectsList';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { userData, logout } = useAuth();
  const { projects, addProject } = useProjects();
  const { credits } = useCredits();
  const { unreadCount } = useNotifications();
  const { receivedInvites } = useInvitations();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const projectList = projects ?? [];

  const stats = useMemo(() => {
    const totalFiles = projectList.reduce((acc, p) => {
      const fileCount = (p.fileCount || {}) as { pdf?: number; dwg?: number; img?: number };
      return acc + (fileCount.pdf || 0) + (fileCount.dwg || 0) + (fileCount.img || 0);
    }, 0);

    const totalSize = projectList.reduce((acc, p) => acc + Number(p.totalSize || 0), 0);
    const activeCount = projectList.filter((p) => p.status === 'Aktif').length;
    return { totalFiles, totalSize, activeCount };
  }, [projectList]);

  const handleCreateProject = async (values: { name: string; location?: string }): Promise<boolean> => {
    setCreating(true);
    try {
      await addProject({
        name: values.name.trim(),
        location: values.location?.trim(),
        status: 'Aktif',
      });
      setShowAddModal(false);
      return true;
    } catch (err: any) {
      Alert.alert(t('error'), err?.message || t('projectCreateFailed'));
      return false;
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      Alert.alert(t('error'), t('logoutFailed'));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row justify-between items-center mb-6 mt-2">
          <View>
            <Text className="text-gray-400 text-sm">{t('welcome')}</Text>
            <Text className="text-white text-2xl font-bold">{userData?.name || t('user')}</Text>
          </View>
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => setShowSearchModal(true)}
              className="w-11 h-11 bg-[#1a1c23] rounded-2xl border border-[#2a2d36] items-center justify-center mr-2"
              accessibilityRole="button"
              accessibilityLabel={t('search')}
              accessibilityHint={t('searchProjects')}
            >
              <Search size={18} color="#c6a87c" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              className="px-3 py-2 bg-[#1a1c23] rounded-xl border border-[#2a2d36]"
              accessibilityRole="button"
              accessibilityLabel={t('logout')}
            >
              <Text className="text-red-400 font-semibold">{t('logout')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-[#c6a87c] p-5 rounded-3xl mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-[#0f1115]/70 font-semibold mb-1">{t('currentCredits')}</Text>
            <Text className="text-[#0f1115] text-4xl font-bold">{credits ?? 0}</Text>
          </View>
          <Sparkles size={28} color="#0f1115" />
        </View>

        <StatsCards
          activeCount={stats.activeCount}
          totalFiles={stats.totalFiles}
          unreadCount={unreadCount}
          pendingInviteCount={receivedInvites.length}
        />

        <QuickActionsGrid
          onCreateProject={() => setShowAddModal(true)}
          onOpenAiStudio={() => router.push('/(tabs)/ai')}
          onOpenInbox={() => router.push('/(tabs)/inbox')}
          onOpenSubscription={() => router.push('/subscription')}
          onOpenCredits={() => router.push('/credits')}
          onOpenWorkspace={() => router.push('/workspace')}
          onOpenSettings={() => router.push('/settings')}
          onOpenTrash={() => router.push('/trash')}
        />

        <RecentProjectsList
          projects={projectList}
          onPressProject={(id) => router.push(`/project/${id}`)}
        />
      </ScrollView>

      <ProjectCreateModal
        visible={showAddModal}
        creating={creating}
        onCreate={handleCreateProject}
        onClose={() => setShowAddModal(false)}
      />

      <SearchModal visible={showSearchModal} projects={projectList} onClose={() => setShowSearchModal(false)} />
    </SafeAreaView>
  );
}
