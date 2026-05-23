import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import type { DocumentData, DocumentSnapshot, FirestoreError, QuerySnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import {
  deductCreditsSecure,
  ensureUserProfileSecure,
  refundCreditsSecure,
} from '../services/entitlementService';
import type { CreditHistoryEntry, CreditTransactionItem, CreditsContextType, UserProfile } from '../types';

export const INITIAL_CREDITS = 500;

type UserProfileExtraData = { email?: string | null; displayName?: string | null };
type TimestampLike = { toDate?: () => Date };
type CreditTransactionSource = {
  id?: unknown;
  type?: unknown;
  amount?: unknown;
  credits?: unknown;
  description?: unknown;
  label?: unknown;
  createdAt?: unknown;
};
type CreditHistorySource = {
  type?: unknown;
  amount?: unknown;
  description?: unknown;
  createdAt?: unknown;
};

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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    return message ? String(message) : fallback;
  }
  return fallback;
}

export async function ensureUserProfile(uid: string, extraData: UserProfileExtraData = {}): Promise<UserProfile | null> {
  const ref = doc(db, 'users', uid);
  try {
    await ensureUserProfileSecure(extraData);
  } catch {
    // Callable gecici olarak ulasilamazsa mevcut profili okumaya devam et.
  }

  const snap: DocumentSnapshot<DocumentData> = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export function useCredits(): CreditsContextType {
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [plan, setPlan] = useState('free');
  const [creditHistory, setCreditHistory] = useState<CreditHistoryEntry[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransactionItem[]>([]);
  const [creditTransactionsLoading, setCreditTransactionsLoading] = useState(false);
  const [creditTransactionsLoaded, setCreditTransactionsLoaded] = useState(false);
  const [creditTransactionsError, setCreditTransactionsError] = useState('');
  const [loading, setLoading] = useState(true);

  const normalizeTransactionItem = (item: CreditTransactionSource = {}, id = ''): CreditTransactionItem => {
    const rawDate = item?.createdAt;
    const parsedDate =
      typeof rawDate === 'string'
        ? new Date(rawDate)
        : hasToDate(rawDate) && rawDate.toDate?.()
          ? rawDate.toDate()
          : null;

    const amountValue = Number(item?.amount ?? item?.credits ?? 0);
    const normalizedType = String(item?.type || '').trim().toLowerCase();
    const resolvedType =
      normalizedType === 'spend' || normalizedType === 'usage' || normalizedType === 'debit' || amountValue < 0
        ? 'spend'
        : 'load';

    return {
      id: String(item?.id || id || Date.now()),
      type: resolvedType,
      amount: Math.abs(amountValue),
      description: (item?.description || item?.label || 'Kredi işlemi') as string,
      createdAt: parsedDate,
    };
  };

  const applyCreditState = (data: UserProfile = {}): void => {
    setCredits((data.credits ?? 0) as number);
    setPlan((data.plan ?? 'free') as string);
  };

  async function refetchCredits(): ReturnType<CreditsContextType['refetchCredits']> {
    if (!user) {
      setCredits(null);
      setPlan('free');
      setCreditHistory([]);
      setLoading(false);
      return null;
    }

    setLoading(true);
    const ref = doc(db, 'users', user.uid);

    try {
      let snap: DocumentSnapshot<DocumentData> = await getDoc(ref);
      if (!snap.exists()) {
        await ensureUserProfile(user.uid, { email: user.email, displayName: user.displayName || '' });
        snap = await getDoc(ref);
      }

      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        applyCreditState(data);
        return data;
      }

      return null;
    } finally {
      setLoading(false);
    }
  }

  async function fetchCreditTransactions(force = false): ReturnType<CreditsContextType['fetchCreditTransactions']> {
    if (!user?.uid) {
      setCreditTransactions([]);
      setCreditTransactionsError('');
      setCreditTransactionsLoaded(true);
      return [];
    }

    if (creditTransactionsLoaded && !force) {
      return creditTransactions;
    }

    setCreditTransactionsLoading(true);
    setCreditTransactionsError('');
    try {
      const transactionsQuery = query(
        collection(db, 'creditTransactions'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const snap: QuerySnapshot<DocumentData> = await getDocs(transactionsQuery);
      const items = snap.docs.map((docSnap) => normalizeTransactionItem(docSnap.data(), docSnap.id));
      setCreditTransactions(items);
      setCreditTransactionsLoaded(true);
      return items;
    } catch (error) {
      setCreditTransactions([]);
      setCreditTransactionsLoaded(true);
      setCreditTransactionsError(getErrorMessage(error, 'Fatura kayıtları yüklenemedi.'));
      return [];
    } finally {
      setCreditTransactionsLoading(false);
    }
  }

  useEffect((): (() => void) | undefined => {
    if (!user) {
      setCredits(null);
      setPlan('free');
      setCreditHistory([]);
      setCreditTransactions([]);
      setCreditTransactionsError('');
      setCreditTransactionsLoaded(false);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', user.uid);
    const unsubUser: Unsubscribe = onSnapshot(
      ref,
      async (snap: DocumentSnapshot<DocumentData>) => {
        if (snap.exists()) {
          applyCreditState(snap.data() as UserProfile);
        } else {
          await ensureUserProfile(user.uid, { email: user.email, displayName: user.displayName || '' });
        }
        setLoading(false);
      },
      (_error: FirestoreError) => undefined
    );

    const txQuery = query(
      collection(db, 'users', user.uid, 'transactions'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubTx: Unsubscribe = onSnapshot(
      txQuery,
      (snap: QuerySnapshot<DocumentData>) => {
        const items = snap.docs.map((d) => {
          const row = d.data();
          return {
            type: (row.type || 'spend') as CreditHistoryEntry['type'],
            amount: Number(row.amount || 0),
            description: (row.description || 'Kredi islemi') as string,
            createdAt: toDate(row.createdAt),
          };
        });
        setCreditHistory(items);
      },
      (_error: FirestoreError) => undefined
    );

    return () => {
      unsubUser();
      unsubTx();
    };
  }, [user]);

  async function deductCredits(amount: number, description = 'AI islemi'): ReturnType<CreditsContextType['deductCredits']> {
    if (!user) throw new Error('Oturum acmaniz gerekiyor.');
    if (credits === null) throw new Error('Kredi bilgisi yukleniyor...');
    if (credits < amount) {
      throw new Error(`Yetersiz kredi. Islem icin ${amount} kredi gerekli, mevcut: ${credits}.`);
    }

    await deductCreditsSecure(amount, description);
  }

  async function addCredits(amount: number, description = 'Kredi yukleme'): ReturnType<CreditsContextType['addCredits']> {
    if (!user) throw new Error('Oturum acmaniz gerekiyor.');

    await refundCreditsSecure(amount, description);
  }

  function hasEnough(amount: number): boolean {
    return credits !== null && credits >= amount;
  }

  return {
    credits,
    plan,
    creditHistory,
    creditTransactions,
    creditTransactionsLoading,
    creditTransactionsLoaded,
    creditTransactionsError,
    loading,
    deductCredits,
    addCredits,
    hasEnough,
    refetchCredits,
    fetchCreditTransactions,
  };
}
