import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

type AIStudioPromptSectionProps = {
  prompt: string;
  presets: string[];
  onChangePrompt: (value: string) => void;
  onSelectPreset: (preset: string) => void;
};

export default function AIStudioPromptSection({ prompt, presets, onChangePrompt, onSelectPreset }: AIStudioPromptSectionProps) {
  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
      <Text className="text-white font-semibold mb-3">Ekstra Not (opsiyonel)</Text>
      <TextInput
        className="bg-[#0f1115] text-white p-4 rounded-xl border border-[#2a2d36] min-h-[96px]"
        placeholder="AI aracina yon verecek notlar..."
        placeholderTextColor="#4b5563"
        multiline
        value={prompt}
        onChangeText={onChangePrompt}
      />

      {presets.length > 0 ? (
        <View className="mt-3">
          <Text className="text-gray-400 text-xs mb-2">Hazir Prompt Onerileri</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {presets.map((preset) => (
              <TouchableOpacity
                key={preset}
                className="bg-[#0f1115] border border-[#2a2d36] rounded-lg px-3 py-2 mr-2"
                onPress={() => onSelectPreset(preset)}
              >
                <Text className="text-gray-200 text-xs" numberOfLines={1}>
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
