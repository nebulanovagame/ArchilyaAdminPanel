import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { AiSelectOption, ImagePickerSource, SceneReference } from './types';

type AIStudioSceneSettingsProps = {
  modes: AiSelectOption[];
  referenceTypes: AiSelectOption[];
  selectedWorkflow: string;
  selectedReferenceType: string;
  sceneReferenceLabel: string;
  sceneReferenceNote: string;
  sceneReferenceImages: SceneReference[];
  busy: boolean;
  picking: boolean;
  onSelectWorkflow: (workflowId: string) => void;
  onSelectReferenceType: (referenceTypeId: string) => void;
  onChangeSceneReferenceLabel: (value: string) => void;
  onChangeSceneReferenceNote: (value: string) => void;
  onPickReferenceImage: (source: ImagePickerSource) => void;
  onClearSceneReferences: () => void;
  onRemoveSceneReference: (referenceId: string) => void;
};

export default function AIStudioSceneSettings({
  modes,
  referenceTypes,
  selectedWorkflow,
  selectedReferenceType,
  sceneReferenceLabel,
  sceneReferenceNote,
  sceneReferenceImages,
  busy,
  picking,
  onSelectWorkflow,
  onSelectReferenceType,
  onChangeSceneReferenceLabel,
  onChangeSceneReferenceNote,
  onPickReferenceImage,
  onClearSceneReferences,
  onRemoveSceneReference,
}: AIStudioSceneSettingsProps) {
  const disablePickers = busy || picking;

  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
      <Text className="text-white font-semibold mb-3">Sahne duzenleme ayarlari</Text>

      <Text className="text-gray-400 mb-2">Duzenleme modu</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
        {modes.map((mode) => (
          <TouchableOpacity
            key={mode.id}
            className={`px-3 py-2 rounded-lg mr-2 border ${selectedWorkflow === mode.id ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
            onPress={() => onSelectWorkflow(mode.id)}
          >
            <Text className={selectedWorkflow === mode.id ? 'text-[#c6a87c] font-semibold' : 'text-white'}>{mode.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text className="text-gray-400 mb-2">Referans tipi</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
        {referenceTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            className={`px-3 py-2 rounded-lg mr-2 border ${selectedReferenceType === type.id ? 'bg-[#c6a87c]/20 border-[#c6a87c]/40' : 'bg-[#0f1115] border-[#2a2d36]'}`}
            onPress={() => onSelectReferenceType(type.id)}
          >
            <Text className={selectedReferenceType === type.id ? 'text-[#c6a87c] font-semibold' : 'text-white'}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TextInput
        className="bg-[#0f1115] text-white p-3 rounded-xl border border-[#2a2d36] mb-3"
        placeholder="Referans etiketi (opsiyonel)"
        placeholderTextColor="#4b5563"
        value={sceneReferenceLabel}
        onChangeText={onChangeSceneReferenceLabel}
      />
      <TextInput
        className="bg-[#0f1115] text-white p-3 rounded-xl border border-[#2a2d36]"
        placeholder="Referans notu (opsiyonel)"
        placeholderTextColor="#4b5563"
        value={sceneReferenceNote}
        onChangeText={onChangeSceneReferenceNote}
      />

      <View className="flex-row mt-3">
        <TouchableOpacity
          className="flex-1 bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] items-center mr-2"
          onPress={() => onPickReferenceImage('camera')}
          disabled={disablePickers}
        >
          <Text className="text-[#c6a87c] font-semibold">Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] items-center mr-2"
          onPress={() => onPickReferenceImage('gallery')}
          disabled={disablePickers}
        >
          <Text className="text-[#c6a87c] font-semibold">Galeri</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] items-center"
          onPress={() => onPickReferenceImage('document')}
          disabled={disablePickers}
        >
          <Text className="text-[#c6a87c] font-semibold">Dosya</Text>
        </TouchableOpacity>
      </View>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-gray-400 text-xs">Ekli referans: {sceneReferenceImages.length}/4</Text>
        {sceneReferenceImages.length > 0 ? (
          <TouchableOpacity onPress={onClearSceneReferences}>
            <Text className="text-red-400 text-xs font-semibold">Tumunu Kaldir</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {sceneReferenceImages.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
          {sceneReferenceImages.map((reference) => (
            <View key={reference.id} className="w-44 mr-3 bg-[#0f1115] p-2 rounded-xl border border-[#2a2d36]">
              <Image source={{ uri: reference.uri }} className="w-full h-28 rounded-lg" contentFit="cover" cachePolicy="memory-disk" />
              <Text className="text-white text-xs font-semibold mt-2" numberOfLines={1}>
                {reference.label || reference.name}
              </Text>
              <Text className="text-gray-500 text-[10px] mt-1" numberOfLines={1}>
                {reference.type}
              </Text>
              <TouchableOpacity
                className="mt-2 bg-red-500/10 border border-red-500/30 rounded-md py-1 items-center"
                onPress={() => onRemoveSceneReference(reference.id)}
              >
                <Text className="text-red-400 text-[11px] font-semibold">Kaldir</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
