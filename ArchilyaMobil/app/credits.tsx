import React, { useMemo } from 'react';
import { Platform, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Sparkles } from 'lucide-react-native';
import { useCredits } from '../src/hooks/useCredits';

function formatDate(dateValue: any) {
  try {
    return new Date(dateValue).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Bilinmeyen tarih';
  }
}

export default function CreditsScreen() {
  const router = useRouter();
  const { credits, plan, creditHistory } = useCredits();

  const stats = useMemo(() => {
    const earned = creditHistory
      .filter((item: any) => item.type === 'earn')
      .reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
    const spent = creditHistory
      .filter((item: any) => item.type === 'spend')
      .reduce((sum: number, item: any) => sum + (item.amount || 0), 0);

    return { earned, spent };
  }, [creditHistory]);

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" style={{ paddingTop: Platform.OS === 'android' ? 36 : 0 }}>
      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="flex-row items-center mb-5">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 bg-[#1a1c23] p-2 rounded-lg">
            <ArrowLeft size={18} color="#c6a87c" />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold">Kredi Gecmisi</Text>
        </View>

        <View className="bg-[#1a1c23] p-5 rounded-2xl border border-[#2a2d36] mb-4">
          <Text className="text-gray-400 text-xs uppercase">Mevcut Bakiye</Text>
          <View className="flex-row items-center mt-2">
            <Sparkles size={18} color="#c6a87c" />
            <Text className="text-white text-3xl font-bold ml-2">{credits ?? 0}</Text>
          </View>
          <Text className="text-gray-400 mt-2">Plan: {plan || 'free'}</Text>
        </View>

        <View className="flex-row flex-wrap justify-between mb-4">
          <View className="w-[48%] bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
            <Text className="text-gray-400 text-xs">Toplam Kazanilan</Text>
            <Text className="text-emerald-300 text-2xl font-bold mt-1">+{stats.earned}</Text>
          </View>
          <View className="w-[48%] bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
            <Text className="text-gray-400 text-xs">Toplam Harcanan</Text>
            <Text className="text-rose-300 text-2xl font-bold mt-1">-{stats.spent}</Text>
          </View>
        </View>

        <View className="bg-[#1a1c23] p-4 rounded-2xl border border-[#2a2d36]">
          <Text className="text-white font-semibold mb-3">Islem Kayitlari</Text>

          {creditHistory.length === 0 ? (
            <Text className="text-gray-500">Henuz kredi islemi yok.</Text>
          ) : (
            creditHistory.map((item: any, index: number) => {
              const isEarn = item.type === 'earn';
              return (
                <View key={`${item.createdAt}_${index}`} className="bg-[#0f1115] p-3 rounded-xl border border-[#2a2d36] mb-2">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-1 pr-3">
                      <Text className="text-white font-semibold">{item.description}</Text>
                      <Text className="text-gray-500 text-xs mt-1">{formatDate(item.createdAt)}</Text>
                    </View>
                    <View className="flex-row items-center">
                      {isEarn ? <ArrowDownLeft size={15} color="#34d399" /> : <ArrowUpRight size={15} color="#fb7185" />}
                      <Text className={`ml-1 font-bold ${isEarn ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {isEarn ? '+' : '-'}{item.amount}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
