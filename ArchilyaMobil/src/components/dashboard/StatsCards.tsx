import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

type StatsCardsProps = {
  activeCount: number;
  totalFiles: number;
  unreadCount: number;
  pendingInviteCount: number;
};

export default function StatsCards({ activeCount, totalFiles, unreadCount, pendingInviteCount }: StatsCardsProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-row flex-wrap justify-between mb-6">
      <View className="w-[48%] bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-3">
        <Text className="text-gray-400 text-xs">{t('activeProject')}</Text>
        <Text className="text-white text-2xl font-bold mt-1">{activeCount}</Text>
      </View>
      <View className="w-[48%] bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-3">
        <Text className="text-gray-400 text-xs">{t('totalFiles')}</Text>
        <Text className="text-white text-2xl font-bold mt-1">{totalFiles}</Text>
      </View>
      <View className="w-[48%] bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
        <Text className="text-gray-400 text-xs">{t('notification')}</Text>
        <Text className="text-white text-2xl font-bold mt-1">{unreadCount}</Text>
      </View>
      <View className="w-[48%] bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
        <Text className="text-gray-400 text-xs">{t('pendingInvite')}</Text>
        <Text className="text-white text-2xl font-bold mt-1">{pendingInviteCount}</Text>
      </View>
    </View>
  );
}
