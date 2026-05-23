"use client";

import { useEffect, useState } from "react";
import { onSnapshot, type Query, type QuerySnapshot } from "firebase/firestore";

type UseFirestoreQueryOptions<T> = {
  queryRef: Query | null;
  initialData: T;
  mapSnapshot: (snapshot: QuerySnapshot) => T;
};

export function useFirestoreQuery<T>({ queryRef, initialData, mapSnapshot }: UseFirestoreQueryOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(Boolean(queryRef));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!queryRef) {
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

    let loadingCancelled = false;
    queueMicrotask(() => {
      if (loadingCancelled) return;
      setLoading(true);
    });
    const unsubscribe = onSnapshot(
      queryRef,
      (snapshot) => {
        setData(mapSnapshot(snapshot));
        setError(null);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError as Error);
        setLoading(false);
      },
    );

    return () => {
      loadingCancelled = true;
      unsubscribe();
    };
  }, [initialData, mapSnapshot, queryRef]);

  return { data, loading, error };
}
