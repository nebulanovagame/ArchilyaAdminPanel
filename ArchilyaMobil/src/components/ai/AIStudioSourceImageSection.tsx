import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { ImagePickerSource, PickedImage } from './types';

type AIStudioSourceImageSectionProps = {
  sourceImage: PickedImage | null;
  busy: boolean;
  picking: boolean;
  onPickSourceImage: (source: ImagePickerSource) => void;
};

export default function AIStudioSourceImageSection({ sourceImage, busy, picking, onPickSourceImage }: AIStudioSourceImageSectionProps) {
  const disablePickers = busy || picking;

  return (
    <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-4">
      <Text className="text-white font-semibold mb-3">Ana Gorsel</Text>
      <View className="flex-row">
        <TouchableOpacity
          className="flex-1 bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] items-center mr-2"
          onPress={() => onPickSourceImage('camera')}
          disabled={disablePickers}
        >
          <Text className="text-[#c6a87c] font-semibold">Kamera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] items-center mr-2"
          onPress={() => onPickSourceImage('gallery')}
          disabled={disablePickers}
        >
          <Text className="text-[#c6a87c] font-semibold">Galeri</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] items-center"
          onPress={() => onPickSourceImage('document')}
          disabled={disablePickers}
        >
          <Text className="text-[#c6a87c] font-semibold">Dosya</Text>
        </TouchableOpacity>
      </View>
      {picking ? <ActivityIndicator color="#c6a87c" className="mt-3" /> : null}
      {sourceImage ? (
        <View className="mt-3">
          <Image source={{ uri: sourceImage.uri }} className="w-full h-56 rounded-xl" contentFit="cover" cachePolicy="memory-disk" />
          <Text className="text-gray-400 mt-2 text-xs">{sourceImage.name}</Text>
        </View>
      ) : null}
    </View>
  );
}
