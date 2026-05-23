import React from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock3, FileText, Image as ImageIcon, RotateCcw, Sparkles } from 'lucide-react-native';
import { useAiHistory } from '../src/hooks/useAiHistory';

function formatDate(value: any) {
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Bilinmeyen tarih';
  }
}

function mapStatusLabel(status: string) {
  if (status === 'success') return 'Basarili';
  if (status === 'running') return 'Isleniyor';
  if (status === 'error') return 'Hata';
  return 'Beklemede';
}

function canReplay(item: any) {
  if (!item) return false;
  if (item.status === 'running') return false;

  const sourceImageUri = String(item.sourceImageUri || item.savedFileUrl || '').trim();
  if (!sourceImageUri) return false;

  if (item.toolId === 'sceneedit' && !(Array.isArray(item.sceneReferences) && item.sceneReferences.length > 0)) {
    return false;
  }

  return true;
}

export default function AiHistoryScreen() {
  const router = useRouter();
  const { recentHistory, loading } = useAiHistory();

  const openReplay = (item: any, replayMode: 'retry' | 'variation') => {
    router.push({
      pathname: '/(tabs)/ai',
      params: {
        historyId: item.id,
        replayMode,
        replayNonce: String(Date.now()),
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 bg-[#1a1c23] p-2 rounded-lg">
            <ArrowLeft size={18} color="#c6a87c" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">AI Gecmisi</Text>
        </View>

        {loading ? (
          <View className="items-center py-10">
            <ActivityIndicator color="#c6a87c" />
          </View>
        ) : recentHistory.length === 0 ? (
          <View className="bg-[#1a1c23] p-5 rounded-2xl border border-[#2a2d36]">
            <Text className="text-gray-400 text-center">Henuz AI gecmisi yok.</Text>
          </View>
        ) : (
          recentHistory.map((item: any) => {
            const isImage = item.outputType === 'image';
            return (
              <View key={item.id} className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36] mb-3">
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center flex-1 pr-2">
                    {isImage ? <ImageIcon size={16} color="#c6a87c" /> : <FileText size={16} color="#c6a87c" />}
                    <Text className="text-white font-semibold ml-2">{item.toolLabel || item.toolId || 'AI Araci'}</Text>
                  </View>
                  <Text className="text-xs text-[#c6a87c]">{mapStatusLabel(item.status)}</Text>
                </View>

                <View className="flex-row items-center mt-2">
                  <Clock3 size={12} color="#6b7280" />
                  <Text className="text-gray-500 text-xs ml-1">{formatDate(item.createdAt)}</Text>
                  {item.mode === 'retry' || item.mode === 'variation' ? (
                    <View className="flex-row items-center ml-3">
                      <RotateCcw size={11} color="#9ca3af" />
                      <Text className="text-gray-400 text-xs ml-1">{item.mode}</Text>
                    </View>
                  ) : null}
                </View>

                {item.promptPreview ? (
                  <Text className="text-gray-300 text-xs mt-2" numberOfLines={4}>
                    {item.promptPreview}
                  </Text>
                ) : null}

                {item.resultTextPreview ? (
                  <View className="bg-[#0f1115] border border-[#2a2d36] rounded-xl p-3 mt-3">
                    <Text className="text-gray-300 text-xs" numberOfLines={5}>
                      {item.resultTextPreview}
                    </Text>
                  </View>
                ) : null}

                <View className="flex-row mt-3">
                  {item.savedProjectId ? (
                    <TouchableOpacity
                      className="bg-[#0f1115] border border-[#2a2d36] rounded-lg px-3 py-2 mr-2"
                      onPress={() => router.push(`/project/${item.savedProjectId}`)}
                    >
                      <Text className="text-[#c6a87c] text-xs font-semibold">Projeyi Ac</Text>
                    </TouchableOpacity>
                  ) : null}

                  {item.savedFileUrl ? (
                    <TouchableOpacity
                      className="bg-[#0f1115] border border-[#2a2d36] rounded-lg px-3 py-2"
                      onPress={() =>
                        router.push({
                          pathname: '/file-preview',
                          params: {
                            url: item.savedFileUrl,
                            name: item.toolLabel || 'AI Sonucu',
                            type: item.resultMimeType || 'image/png',
                          },
                        })
                      }
                    >
                      <Text className="text-[#9cc6ff] text-xs font-semibold">Sonucu Ac</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {canReplay(item) ? (
                  <View className="flex-row mt-2">
                    <TouchableOpacity
                      className="bg-[#0f1115] border border-[#2a2d36] rounded-lg px-3 py-2 mr-2 flex-row items-center"
                      onPress={() => openReplay(item, 'retry')}
                    >
                      <RotateCcw size={12} color="#c6a87c" />
                      <Text className="text-[#c6a87c] text-xs font-semibold ml-2">Tekrar Uret</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="bg-[#0f1115] border border-[#2a2d36] rounded-lg px-3 py-2 flex-row items-center"
                      onPress={() => openReplay(item, 'variation')}
                    >
                      <Sparkles size={12} color="#9cc6ff" />
                      <Text className="text-[#9cc6ff] text-xs font-semibold ml-2">Varyasyon Uret</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {item.errorMessage ? <Text className="text-red-400 text-xs mt-2">{item.errorMessage}</Text> : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
