import React from 'react';
import { Text, View } from 'react-native';

type AIStudioStatusBannersProps = {
  historyWritable: boolean;
  aiErrorMessage: string;
  aiErrorHint: string;
};

export default function AIStudioStatusBanners({ historyWritable, aiErrorMessage, aiErrorHint }: AIStudioStatusBannersProps) {
  return (
    <>
      {!historyWritable ? (
        <View className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4">
          <Text className="text-amber-300 text-xs">
            AI gecmisi icin yazma izni yok. Uretim devam eder, sadece gecmis kaydi tutulmaz.
          </Text>
        </View>
      ) : null}

      {aiErrorMessage ? (
        <View className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <Text className="text-red-300 text-sm font-semibold">AI Islem Hatasi</Text>
          <Text className="text-red-200 text-xs mt-1">{aiErrorMessage}</Text>
          {aiErrorHint ? <Text className="text-red-100 text-[11px] mt-2">{aiErrorHint}</Text> : null}
        </View>
      ) : null}
    </>
  );
}
