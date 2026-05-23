import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AiSelectOption } from './types';

type AIStudioStyleSelectorProps = {
  styles: AiSelectOption[];
  selectedStyle: string;
  onSelectStyle: (styleId: string) => void;
};

export default function AIStudioStyleSelector({ styles, selectedStyle, onSelectStyle }: AIStudioStyleSelectorProps) {
  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
      <Text className="text-white font-semibold mb-3">Stil secin</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {styles.map((style) => (
          <TouchableOpacity
            key={style.id}
            className={`px-3 py-2 rounded-lg mr-2 border ${selectedStyle === style.id ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
            onPress={() => onSelectStyle(style.id)}
          >
            <Text className={selectedStyle === style.id ? 'text-[#c6a87c] font-semibold' : 'text-white'}>{style.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
