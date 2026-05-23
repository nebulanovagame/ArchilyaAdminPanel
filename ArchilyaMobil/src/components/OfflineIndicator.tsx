import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import NetInfo from '@react-native-community/netinfo';

export default function OfflineIndicator() {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      setIsOffline(offline);
    });

    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <View
      className="absolute top-0 left-0 right-0 z-50 bg-[#c6a87c] px-4 py-2 items-center justify-center"
      style={{ paddingTop: 44 }}
      accessibilityRole="alert"
      accessibilityLabel={t('offline')}
    >
      <Text className="text-[#0f1115] font-bold text-sm">{t('offline')}</Text>
    </View>
  );
}
