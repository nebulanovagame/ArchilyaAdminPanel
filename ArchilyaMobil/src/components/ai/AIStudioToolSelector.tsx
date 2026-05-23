import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { AiToolOption } from './types';

type AIStudioToolSelectorProps = {
  tools: AiToolOption[];
  selectedToolId: string;
  onSelectTool: (toolId: string) => void;
};

export default function AIStudioToolSelector({ tools, selectedToolId, onSelectTool }: AIStudioToolSelectorProps) {
  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
      <Text className="text-white font-semibold mb-3">Arac secin</Text>
      {tools.map((tool) => (
        <TouchableOpacity
          key={tool.id}
          className={`p-3 rounded-xl mb-2 border ${selectedToolId === tool.id ? 'bg-[#c6a87c]/15 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
          onPress={() => onSelectTool(tool.id)}
        >
          <View className="flex-row justify-between">
            <Text className="text-white font-medium">{tool.label}</Text>
            <Text className="text-[#c6a87c]">{tool.cost} kredi</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
