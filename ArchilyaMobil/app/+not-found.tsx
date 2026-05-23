import React from 'react';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1 bg-[#0f1115]">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-full items-center">
            <Text className="text-[120px] leading-[120px] font-black tracking-[6px] text-[#c6a87c] opacity-10">
              404
            </Text>

            <View className="-mt-5 w-full rounded-3xl border border-[#2a2d36] bg-[#1a1c23] px-6 py-8 items-center">
              <Text className="text-center text-2xl font-bold text-white">Sayfa bulunamadı</Text>

              <TouchableOpacity
                className="mt-6 w-full rounded-2xl bg-[#c6a87c] px-5 py-4 items-center"
                onPress={() => router.replace('/(tabs)')}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Ana Sayfaya Don"
              >
                <Text className="text-[#0f1115] text-base font-bold">Ana Sayfaya Dön</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}
