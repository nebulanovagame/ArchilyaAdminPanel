import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import type { EventSubscription } from 'expo-notifications';
import { useAuth } from '../context/AuthContext';
import {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
  registerForPushNotificationsAsync,
} from '../services/pushNotificationService';
import { registerPushTokenSecure } from '../services/entitlementService';
import { captureException } from '../services/errorTracking';
import type { LastNotificationResponse, PushNotificationsContextType } from '../types';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return message ? String(message) : fallback;
  }
  return fallback;
}

export function usePushNotifications(): PushNotificationsContextType {
  const { user } = useAuth();
  const [pushToken, setPushToken] = useState('');
  const [pushError, setPushError] = useState('');
  const [lastNotification, setLastNotification] = useState<Record<string, unknown> | null>(null);
  const [lastNotificationResponse, setLastNotificationResponse] = useState<LastNotificationResponse | null>(null);
  const registeredUserRef = useRef('');

  useEffect(() => {
    const currentUser = user;

    if (!currentUser?.uid) {
      setPushToken('');
      setPushError('');
      setLastNotification(null);
      setLastNotificationResponse(null);
      registeredUserRef.current = '';
      return;
    }

    const currentUserId = currentUser.uid;

    if (registeredUserRef.current === currentUserId) return;

    let receivedSubscription: EventSubscription | null = null;
    let responseSubscription: EventSubscription | null = null;
    let cancelled = false;

    async function init(): Promise<void> {
      try {
        const token = await registerForPushNotificationsAsync();
        if (cancelled || !token) return;

        setPushToken(token);
        setPushError('');
        registeredUserRef.current = currentUserId;

        await registerPushTokenSecure(token).catch(() => null);
      } catch (err) {
        if (cancelled) return;
        captureException(err, { scope: 'mobile_push_init' });
        setPushError(getErrorMessage(err, 'Push token alinamadi.'));
      }

      receivedSubscription = addNotificationReceivedListener((notification: Notifications.Notification) => {
        setLastNotification(notification as unknown as Record<string, unknown>);
      });

      responseSubscription = addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
        const notification = response?.notification || null;
        setLastNotification(notification as unknown as Record<string, unknown> | null);
        setLastNotificationResponse({
          receivedAt: Date.now(),
          data: notification?.request?.content?.data || {},
          title: notification?.request?.content?.title || '',
          body: notification?.request?.content?.body || '',
        });
      });
    }

    init();

    return () => {
      cancelled = true;
      receivedSubscription?.remove?.();
      responseSubscription?.remove?.();
    };
  }, [user]);

  return {
    pushToken,
    pushError,
    lastNotification,
    lastNotificationResponse,
  };
}
