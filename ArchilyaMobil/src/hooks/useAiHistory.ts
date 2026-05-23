import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import type { DocumentData, FirestoreError, QuerySnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { logAiHistoryEntrySecure, updateAiHistoryEntrySecure } from '../services/entitlementService';
import type { AiHistoryContextType, AiHistoryEntry, SceneReferenceEntry } from '../types';

type TimestampLike = { toDate?: () => Date };

function normalizeText(value: unknown, maxLen = 500): string {
  return String(value || '').trim().slice(0, maxLen);
}

function normalizeUri(value: unknown, maxLen = 5000): string {
  return String(value || '').trim().slice(0, maxLen);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function hasToDate(value: unknown): value is TimestampLike {
  return Boolean(value && typeof value === 'object' && typeof (value as TimestampLike).toDate === 'function');
}

function normalizeSceneReferences(value: unknown): SceneReferenceEntry[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 4).map((item) => {
    const row = isRecord(item) ? item : {};
    return {
      uri: normalizeUri(row.uri, 5000),
      mimeType: normalizeText(row.mimeType, 60),
      type: normalizeText(row.type, 30),
      label: normalizeText(row.label, 120),
      note: normalizeText(row.note, 500),
    };
  });
}

function isPermissionError(error: unknown): boolean {
  const row = isRecord(error) ? error : {};
  const code = String(row.code || '').toLowerCase();
  const message = String(row.message || '').toLowerCase();
  return (
    code.includes('permission-denied') ||
    message.includes('missing or insufficient permissions')
  );
}

export function useAiHistory(): AiHistoryContextType {
  const { user } = useAuth();
  const [history, setHistory] = useState<AiHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyWritable, setHistoryWritable] = useState(true);

  useEffect((): Unsubscribe | undefined => {
    if (!user?.uid) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'aiHistory'), where('uid', '==', user.uid));

    const unsub: Unsubscribe = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        setHistoryWritable(true);
        const rows = snap.docs
          .map((item) => {
            const row = item.data();
            return {
              id: item.id,
              ...row,
              createdAt: hasToDate(row.createdAt) && row.createdAt.toDate?.() ? row.createdAt.toDate() : new Date(),
              updatedAt: hasToDate(row.updatedAt) && row.updatedAt.toDate?.() ? row.updatedAt.toDate() : new Date(),
              savedAt: hasToDate(row.savedAt) && row.savedAt.toDate?.() ? row.savedAt.toDate() : null,
            } as AiHistoryEntry;
          })
          .sort((a, b) => Number(b.createdAt) - Number(a.createdAt));

        setHistory(rows);
        setLoading(false);
      },
      (error: FirestoreError) => {
        if (isPermissionError(error)) {
          setHistoryWritable(false);
          setHistory([]);
        }
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid]);

  const recentHistory = useMemo(() => history.slice(0, 20), [history]);

  async function logAiHistory(payload: Parameters<AiHistoryContextType['logAiHistory']>[0]): ReturnType<AiHistoryContextType['logAiHistory']> {
    if (!user?.uid || !historyWritable) {
      return '';
    }

    try {
      const result = await logAiHistoryEntrySecure({
        uid: user.uid,
        email: user.email || null,
        toolId: normalizeText(payload?.toolId, 80),
        toolLabel: normalizeText(payload?.toolLabel, 120),
        outputType: normalizeText(payload?.outputType, 20),
        mode: normalizeText(payload?.mode || 'normal', 30),
        style: normalizeText(payload?.style, 80),
        workflow: normalizeText(payload?.workflow, 80),
        promptRaw: normalizeText(payload?.promptRaw, 3000),
        promptPreview: normalizeText(payload?.promptPreview, 1500),
        sourceImageName: normalizeText(payload?.sourceImageName, 180),
        sourceImageMimeType: normalizeText(payload?.sourceImageMimeType, 60),
        sourceImageUri: normalizeUri(payload?.sourceImageUri, 5000),
        sourceProjectId: normalizeText(payload?.sourceProjectId, 120),
        sceneReferences: normalizeSceneReferences(payload?.sceneReferences),
        status: normalizeText(payload?.status || 'queued', 30),
        errorMessage: null,
        resultTextPreview: null,
        hasImageResult: false,
        resultMimeType: null,
        savedProjectId: null,
        savedProjectName: null,
        savedFileUrl: null,
      });

      if (!result?.success || !result?.historyId) {
        throw new Error(result?.message || 'AI gecmisi kaydedilemedi.');
      }

      return String(result.historyId);
    } catch (error) {
      if (isPermissionError(error)) {
        setHistoryWritable(false);
        return '';
      }
      throw error;
    }
  }

  async function updateAiHistoryEntry(historyId: string, data: Parameters<AiHistoryContextType['updateAiHistoryEntry']>[1] = {}): ReturnType<AiHistoryContextType['updateAiHistoryEntry']> {
    if (!historyId) return;

    try {
      const result = await updateAiHistoryEntrySecure(historyId, data || {});
      if (!result?.success) {
        throw new Error(result?.message || 'AI gecmisi guncellenemedi.');
      }
    } catch (error) {
      if (isPermissionError(error)) {
        setHistoryWritable(false);
        return;
      }
      throw error;
    }
  }

  return {
    history,
    recentHistory,
    loading,
    historyWritable,
    logAiHistory,
    updateAiHistoryEntry,
  };
}
