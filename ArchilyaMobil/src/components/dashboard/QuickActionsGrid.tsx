import React from 'react';
import { Text, TouchableOpacity, View, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  Building2,
  Download,
  Plus,
  Sparkles,
  Trash2,
  UserCog,
} from 'lucide-react-native';

const LAUNCHER_URL = 'https://github.com/nebulanovagame/ArchilyaLauncher/releases/latest/download/Archilya-Launcher-Setup.exe';

type QuickActionsGridProps = {
  onCreateProject: () => void;
  onOpenAiStudio: () => void;
  onOpenInbox: () => void;
  onOpenSubscription: () => void;
  onOpenCredits: () => void;
  onOpenWorkspace: () => void;
  onOpenSettings: () => void;
  onOpenTrash: () => void;
};

export default function QuickActionsGrid({
  onCreateProject,
  onOpenAiStudio,
  onOpenInbox,
  onOpenSubscription,
  onOpenCredits,
  onOpenWorkspace,
  onOpenSettings,
  onOpenTrash,
}: QuickActionsGridProps) {
  const { t } = useTranslation();

  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
      <Text className="text-white font-semibold mb-3">{t('quickOperations')}</Text>
      <View className="flex-row flex-wrap justify-between">
        <TouchableOpacity
          className="w-[48%] bg-[#0f1115] p-3 rounded-xl mb-3"
          onPress={onCreateProject}
          accessibilityRole="button"
          accessibilityLabel={t('newProject')}
        >
          <Plus size={18} color="#c6a87c" />
          <Text className="text-[#c6a87c] mt-1 font-semibold">{t('newProject')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-[48%] bg-[#0f1115] p-3 rounded-xl mb-3"
          onPress={onOpenAiStudio}
          accessibilityRole="button"
          accessibilityLabel={t('aiStudio')}
        >
          <Sparkles size={18} color="#c6a87c" />
          <Text className="text-[#c6a87c] mt-1 font-semibold">{t('aiStudio')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-[48%] bg-[#0f1115] p-3 rounded-xl mb-3"
          onPress={onOpenInbox}
          accessibilityRole="button"
          accessibilityLabel={t('inbox')}
        >
          <Bell size={18} color="#c6a87c" />
          <Text className="text-[#c6a87c] mt-1 font-semibold">{t('inbox')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-[48%] bg-[#0f1115] p-3 rounded-xl mb-3"
          onPress={onOpenSubscription}
          accessibilityRole="button"
          accessibilityLabel={t('subscription.label')}
        >
          <Sparkles size={18} color="#c6a87c" />
          <Text className="text-[#c6a87c] mt-1 font-semibold">{t('subscription.label')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-[48%] bg-[#0f1115] p-3 rounded-xl mb-3"
          onPress={onOpenCredits}
          accessibilityRole="button"
          accessibilityLabel={t('creditHistory')}
        >
          <Sparkles size={18} color="#c6a87c" />
          <Text className="text-[#c6a87c] mt-1 font-semibold">{t('creditHistory')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-[48%] bg-[#0f1115] p-3 rounded-xl mb-3"
          onPress={onOpenWorkspace}
          accessibilityRole="button"
          accessibilityLabel={t('workspace')}
        >
          <Building2 size={18} color="#9cc6ff" />
          <Text className="text-[#9cc6ff] mt-1 font-semibold">{t('workspace')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-[48%] bg-[#0f1115] p-3 rounded-xl"
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel={t('settings')}
        >
          <UserCog size={18} color="#c6a87c" />
          <Text className="text-[#c6a87c] mt-1 font-semibold">{t('settings')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-[48%] bg-[#0f1115] p-3 rounded-xl"
          onPress={onOpenTrash}
          accessibilityRole="button"
          accessibilityLabel={t('trash')}
        >
          <Trash2 size={18} color="#c6a87c" />
          <Text className="text-[#c6a87c] mt-1 font-semibold">{t('trash')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-[48%] bg-[#0f1115] p-3 rounded-xl mt-3"
          onPress={() => Linking.openURL(LAUNCHER_URL)}
          accessibilityRole="button"
          accessibilityLabel={t('downloadDesktopApp')}
        >
          <Download size={18} color="#c6a87c" />
          <Text className="text-[#c6a87c] mt-1 font-semibold">{t('downloadDesktopApp')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
