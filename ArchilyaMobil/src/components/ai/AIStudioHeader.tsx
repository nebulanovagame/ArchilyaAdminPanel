import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

type AIStudioHeaderProps = {
  credits: number | null | undefined;
  historyCount: number;
  onOpenHistory: () => void;
};

export default function AIStudioHeader({ credits, historyCount, onOpenHistory }: AIStudioHeaderProps) {
  return (
    <View className="mb-6 mt-2 flex-row justify-between items-start">
      <View className="flex-1 pr-3">
        <Text className="text-white text-3xl font-bold">AI Studio</Text>
        <Text className="text-gray-400 mt-1">runAiStudioToolSecure hattiyla guvenli AI mimari uretim</Text>
        <Text className="text-[#c6a87c] mt-2 font-semibold">Mevcut kredi: {credits ?? 0}</Text>
      </View>

      <TouchableOpacity className="bg-[#1a1c23] border border-[#2a2d36] rounded-xl px-3 py-2" onPress={onOpenHistory}>
        <Text className="text-[#c6a87c] text-xs font-semibold">Gecmis ({historyCount})</Text>
      </TouchableOpacity>
    </View>
  );
}
