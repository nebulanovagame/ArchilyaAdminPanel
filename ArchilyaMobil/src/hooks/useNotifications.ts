import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import type { DocumentData, FirestoreError, QuerySnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { markAllNotificationsReadSecure, markNotificationReadSecure } from '../services/entitlementService';
import type { AppNotification, NotificationsContextType } from '../types';

const NOTIFICATION_CACHE_PREFIX = 'archilya_notifications_cache_';

type TimestampLike = { toDate?: () => Date };

function hasToDate(value: unknown): value is TimestampLike {
  return Boolean(value && typeof value === 'object' && typeof (value as TimestampLike).toDate === 'function');
}

function toDate(value: unknown): Date {
  if (hasToDate(value) && value.toDate?.()) return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

export function useNotifications(): NotificationsContextType {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect((): Unsubscribe | undefined => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const cacheKey = `${NOTIFICATION_CACHE_PREFIX}${String(user.email || '').toLowerCase()}`;
    setLoading(true);

    AsyncStorage.getItem(cacheKey)
      .then((cached) => {
        if (!cached) return;
        const rows: unknown = JSON.parse(cached);
        if (!Array.isArray(rows)) return;

        const hydrated = rows
          .map((item) => {
            const row = isRecord(item) ? item : {};
            return {
              ...row,
              createdAt: toDate(row.createdAt),
            } as AppNotification;
          })
          .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

        setNotifications(hydrated);
        setUnreadCount(hydrated.filter((item) => !item.read).length);
        setLoading(false);
      })
      .catch(() => null);

    const q = query(
      collection(db, 'notifications'),
      where('toEmail', '==', user.email),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const data = snap.docs
          .map((d) => {
            const row = d.data();
            return {
              id: d.id,
              ...row,
              createdAt: toDate(row.createdAt),
            } as AppNotification;
          })
          .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.read).length);
        AsyncStorage.setItem(cacheKey, JSON.stringify(data)).catch(() => null);
        setLoading(false);
      },
      (_error: FirestoreError) => undefined
    );

    return unsub;
  }, [user]);

  async function markAsRead(notifId: string): ReturnType<NotificationsContextType['markAsRead']> {
    const result = await markNotificationReadSecure(notifId);
    if (!result?.success) {
      throw new Error(result?.message || 'Bildirim okundu olarak isaretlenemedi.');
    }
    return result;
  }

  async function markAllAsRead(): ReturnType<NotificationsContextType['markAllAsRead']> {
    const result = await markAllNotificationsReadSecure();
    if (!result?.success) {
      throw new Error(result?.message || 'Bildirimler okundu olarak isaretlenemedi.');
    }
    return result;
  }

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
