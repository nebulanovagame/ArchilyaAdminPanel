import React from 'react';
import { Text, View } from 'react-native';
import { FileText } from 'lucide-react-native';

type AIStudioTextResultSectionProps = {
  resultText: string;
};

export default function AIStudioTextResultSection({ resultText }: AIStudioTextResultSectionProps) {
  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
      <View className="flex-row items-center mb-3">
        <FileText size={18} color="#c6a87c" />
        <Text className="text-white font-semibold ml-2">Uretilen Mimari Rapor</Text>
      </View>
      <View className="bg-[#0f1115] rounded-xl p-3 border border-[#2a2d36]">
        <Text className="text-gray-200 leading-6">{resultText}</Text>
      </View>
    </View>
  );
}
