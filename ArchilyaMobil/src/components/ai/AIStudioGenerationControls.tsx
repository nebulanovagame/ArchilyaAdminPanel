import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Wand2 } from 'lucide-react-native';

type AIStudioGenerationControlsProps = {
  busy: boolean;
  picking: boolean;
  selectedToolCost: number;
  hasLastRunPayload: boolean;
  onGenerate: () => void;
  onRetry: () => void;
  onGenerateVariation: () => void;
};

export default function AIStudioGenerationControls({
  busy,
  picking,
  selectedToolCost,
  hasLastRunPayload,
  onGenerate,
  onRetry,
  onGenerateVariation,
}: AIStudioGenerationControlsProps) {
  const disableActions = busy || picking;

  return (
    <>
      <TouchableOpacity
        className={`p-4 rounded-xl items-center mb-4 ${busy ? 'bg-[#c6a87c]/50' : 'bg-[#c6a87c]'}`}
        onPress={onGenerate}
        disabled={disableActions}
      >
        {busy ? (
          <ActivityIndicator color="#0f1115" />
        ) : (
          <View className="flex-row items-center">
            <Wand2 size={18} color="#0f1115" />
            <Text className="text-[#0f1115] font-bold text-base ml-2">AI Uretimi Baslat ({selectedToolCost} kredi)</Text>
          </View>
        )}
      </TouchableOpacity>

      {hasLastRunPayload ? (
        <View className="flex-row mb-4">
          <TouchableOpacity
            className="flex-1 bg-[#1a1c23] border border-[#2a2d36] rounded-xl p-3 items-center mr-2"
            onPress={onRetry}
            disabled={disableActions}
          >
            <Text className="text-[#c6a87c] font-semibold">Tekrar Uret</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-[#1a1c23] border border-[#2a2d36] rounded-xl p-3 items-center"
            onPress={onGenerateVariation}
            disabled={disableActions}
          >
            <Text className="text-[#9cc6ff] font-semibold">Varyasyon Uret</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );
}
