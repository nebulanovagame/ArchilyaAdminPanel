import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Bell, FolderOpen } from 'lucide-react-native';
import type { Project } from '../../types';

type RecentProjectsListProps = {
  projects: Project[];
  onPressProject: (projectId: string) => void;
};

export default function RecentProjectsList({ projects, onPressProject }: RecentProjectsListProps) {
  const { t } = useTranslation();
  const recent = projects.slice(0, 4);

  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
      <Text className="text-white font-semibold mb-3">{t('recentProjects')}</Text>
      {recent.length === 0 ? (
        <Text className="text-gray-500">{t('noProjectsYet')}</Text>
      ) : (
        recent.map((project) => (
          <TouchableOpacity
            key={project.id}
            className="flex-row items-center justify-between bg-[#0f1115] p-3 rounded-xl mb-2"
            onPress={() => onPressProject(project.id)}
            accessibilityRole="button"
            accessibilityLabel={project.name}
            accessibilityHint={t('recentProjects')}
          >
            <View className="flex-row items-center">
              <FolderOpen size={16} color="#c6a87c" />
              <Text className="text-white ml-2 font-medium">{project.name}</Text>
            </View>
            <Bell size={15} color="#4b5563" />
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}
