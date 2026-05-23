import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Sparkles } from 'lucide-react-native';
import { ResultPreviewMode, SavedResultInfo } from './types';

type AIStudioImageResultSectionProps = {
  resultPreviewMode: ResultPreviewMode;
  previewImageUri: string;
  originalImageUri: string;
  shareBusy: boolean;
  saving: boolean;
  selectedToolId: string;
  savedResultInfo: SavedResultInfo | null;
  onChangeResultPreviewMode: (mode: ResultPreviewMode) => void;
  onShareResult: () => void;
  onOpenSaveModal: () => void;
  onUseResultAsPrimaryScene: () => void;
  onUseResultAsSceneReference: () => void;
};

export default function AIStudioImageResultSection({
  resultPreviewMode,
  previewImageUri,
  originalImageUri,
  shareBusy,
  saving,
  selectedToolId,
  savedResultInfo,
  onChangeResultPreviewMode,
  onShareResult,
  onOpenSaveModal,
  onUseResultAsPrimaryScene,
  onUseResultAsSceneReference,
}: AIStudioImageResultSectionProps) {
  const hasOriginalImage = Boolean(originalImageUri);
  const imageUri = resultPreviewMode === 'before' ? (originalImageUri || previewImageUri) : previewImageUri;

  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
      <View className="flex-row items-center mb-3">
        <Sparkles size={18} color="#c6a87c" />
        <Text className="text-white font-semibold ml-2">Uretilen Sonuc</Text>
      </View>

      <View className="flex-row mb-3">
        <TouchableOpacity
          className={`flex-1 p-2 rounded-lg border mr-2 ${resultPreviewMode === 'after' ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
          onPress={() => onChangeResultPreviewMode('after')}
        >
          <Text className={`text-center text-xs font-semibold ${resultPreviewMode === 'after' ? 'text-[#c6a87c]' : 'text-white'}`}>
            AI Sonucu
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 p-2 rounded-lg border ${resultPreviewMode === 'before' ? 'bg-[#9cc6ff]/20 border-[#9cc6ff]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
          onPress={() => onChangeResultPreviewMode('before')}
          disabled={!hasOriginalImage}
        >
          <Text className={`text-center text-xs font-semibold ${resultPreviewMode === 'before' ? 'text-[#9cc6ff]' : 'text-white'}`}>
            Orijinal
          </Text>
        </TouchableOpacity>
      </View>

      <Image source={{ uri: imageUri }} className="w-full h-64 rounded-xl" contentFit="cover" cachePolicy="memory-disk" />

      <View className="mt-3">
        <View className="flex-row flex-wrap justify-between">
          <TouchableOpacity
            className="w-[48%] mb-2 bg-[#0f1115] border border-[#2a2d36] p-3 rounded-xl items-center"
            onPress={onShareResult}
            disabled={shareBusy}
          >
            <Text className="text-[#9cc6ff] font-semibold">{shareBusy ? 'Paylasiliyor...' : 'Sonucu Paylas'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="w-[48%] mb-2 bg-[#0f1115] border border-[#2a2d36] p-3 rounded-xl items-center"
            onPress={onOpenSaveModal}
            disabled={saving}
          >
            <Text className="text-[#c6a87c] font-semibold">{saving ? 'Kaydediliyor...' : 'Projeye Kaydet'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="w-[48%] mb-2 bg-[#0f1115] border border-[#2a2d36] p-3 rounded-xl items-center"
            onPress={onUseResultAsPrimaryScene}
          >
            <Text className="text-[#c6a87c] font-semibold">Ana Sahne Yap</Text>
          </TouchableOpacity>

          {selectedToolId === 'sceneedit' ? (
            <TouchableOpacity
              className="w-[48%] mb-2 bg-[#0f1115] border border-[#2a2d36] p-3 rounded-xl items-center"
              onPress={onUseResultAsSceneReference}
            >
              <Text className="text-[#9cc6ff] font-semibold">Referansa Ekle</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {savedResultInfo ? (
          <View className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 mt-1">
            <Text className="text-emerald-300 text-xs">
              Kaydedildi: {savedResultInfo.projectName} / {savedResultInfo.fileName}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
