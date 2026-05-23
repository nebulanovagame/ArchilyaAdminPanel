"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { onSnapshot, type DocumentReference, type DocumentSnapshot, type FirestoreError } from "firebase/firestore";

type UseFirestoreDocOptions<T> = {
  ref: DocumentReference | null;
  initialData: T;
  mapSnapshot: (snapshot: DocumentSnapshot) => T;
  retryOnPermissionDenied?: boolean;
};

export function useFirestoreDoc<T>({ ref, initialData, mapSnapshot, retryOnPermissionDenied = true }: UseFirestoreDocOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(Boolean(ref));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ref) {
      let cancelled = false;

      queueMicrotask(() => {
        if (cancelled) return;
        setData(initialData);
        setError(null);
        setLoading(false);
      });

      return () => {
        cancelled = true;
      };
    }

    const docRef = ref;
    let unsubscribe: (() => void) | null = null;
    let retryCount = 0;
    let loadingCancelled = false;
    queueMicrotask(() => {
      if (loadingCancelled) return;
      setLoading(true);
    });
    let retryTimeoutId: number | null = null;
    const maxRetries = 3;
    const backoffMs = [500, 1000, 2000];

    function startListener() {
      unsubscribe = onSnapshot(
        docRef!,
        (snapshot) => {
          retryCount = 0;
          setData(mapSnapshot(snapshot));
          setError(null);
          setLoading(false);
        },
        (nextError: FirestoreError) => {
          if (retryOnPermissionDenied && nextError.code === "permission-denied" && retryCount < maxRetries) {
            const delay = backoffMs[retryCount] ?? 2000;
            retryCount += 1;
            retryTimeoutId = window.setTimeout(() => {
              if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
              }
              startListener();
            }, delay);
            return;
          }

          Sentry.captureException(nextError, { tags: { firestore_path: docRef!.path, firestore_retry_count: retryCount } });
          setError(nextError as Error);
          setLoading(false);
        },
      );
    }

    startListener();

    return () => {
      loadingCancelled = true;
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [initialData, mapSnapshot, ref, retryOnPermissionDenied]);

  return { data, loading, error };
}
