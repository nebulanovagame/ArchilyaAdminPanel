import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

type NotificationReceivedCallback = Parameters<typeof Notifications.addNotificationReceivedListener>[0];
type NotificationResponseCallback = Parameters<typeof Notifications.addNotificationResponseReceivedListener>[0];
type NotificationSubscription = ReturnType<typeof Notifications.addNotificationReceivedListener>;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function resolveProjectId(): string | null {
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    null
  );
}

export async function registerForPushNotificationsAsync(): Promise<string> {
  if (!Device.isDevice) {
    throw new Error('Push bildirimi icin fiziksel cihaz gerekli.');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Push bildirimi izni verilmedi.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#c6a87c',
    });
  }

  const projectId = resolveProjectId();
  if (!projectId) {
    throw new Error('EAS projectId bulunamadi. Push token alinamadi.');
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = String(tokenData?.data || '').trim();

  if (!token) {
    throw new Error('Push token olusturulamadi.');
  }

  return token;
}

export function addNotificationReceivedListener(callback: NotificationReceivedCallback): NotificationSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(callback: NotificationResponseCallback): NotificationSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
