import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { PromptHistoryEntry } from './types';

type AIStudioPromptHistorySectionProps = {
  entries: PromptHistoryEntry[];
  formatDateTime: (value: unknown) => string;
  onSelectEntry: (entry: PromptHistoryEntry) => void;
};

export default function AIStudioPromptHistorySection({ entries, formatDateTime, onSelectEntry }: AIStudioPromptHistorySectionProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
      <Text className="text-white font-semibold mb-3">Son Promptlar</Text>
      {entries.map((entry) => (
        <TouchableOpacity
          key={entry.id}
          className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2"
          onPress={() => onSelectEntry(entry)}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-white text-xs font-semibold uppercase">{entry.toolLabel}</Text>
            <Text className="text-gray-500 text-[10px]">{formatDateTime(entry.createdAt)}</Text>
          </View>
          <Text className="text-gray-400 text-xs mt-2" numberOfLines={2}>
            {entry.extraNote || 'Ek not yok'}
          </Text>
          <Text className="text-gray-500 text-[10px] mt-1">
            {entry.style ? `Stil: ${entry.style}` : 'Stil yok'}
            {entry.sceneEditMode ? ` • Mod: ${entry.sceneEditMode}` : ''}
            {Number.isFinite(entry.referenceCount) ? ` • Referans: ${entry.referenceCount}` : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
