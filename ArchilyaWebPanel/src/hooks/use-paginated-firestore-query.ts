/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore";

type UsePaginatedFirestoreQueryOptions<T, TDocument = DocumentData> = {
  baseQuery: Query<TDocument> | null;
  orderByField: string;
  orderDirection?: "desc" | "asc";
  pageSize?: number;
  mapSnapshot: (snapshot: QuerySnapshot<TDocument>) => T;
  enabled?: boolean;
};

type UsePaginatedFirestoreQueryResult<T> = {
  data: T;
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function usePaginatedFirestoreQuery<T extends unknown[], TDocument = DocumentData>({
  baseQuery,
  orderByField,
  orderDirection = "desc",
  pageSize = 10,
  mapSnapshot,
  enabled = true,
}: UsePaginatedFirestoreQueryOptions<T, TDocument>): UsePaginatedFirestoreQueryResult<T> {
  const [data, setData] = useState<T>([] as unknown as T);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<QueryDocumentSnapshot<TDocument> | null>(null);
  const isMountedRef = useRef(true);
  const fetchVersionRef = useRef(0);

  const buildQuery = useCallback(
    (cursorDoc: QueryDocumentSnapshot<TDocument> | null) => {
      if (!baseQuery) return null;
      let q = query(baseQuery, orderBy(orderByField, orderDirection), limit(pageSize));
      if (cursorDoc) {
        q = query(q, startAfter(cursorDoc));
      }
      return q;
    },
    [baseQuery, orderByField, orderDirection, pageSize],
  );

  const fetchPage = useCallback(
    async (cursorDoc: QueryDocumentSnapshot<TDocument> | null, isRefresh: boolean) => {
      if (!baseQuery || !enabled) return;

      const q = buildQuery(cursorDoc);
      if (!q) return;

      fetchVersionRef.current += 1;
      const currentVersion = fetchVersionRef.current;

      if (isRefresh) {
        setLoading(true);
      }
      setError(null);

      try {
        const snapshot = await getDocs(q);

        if (!isMountedRef.current) return;
        if (fetchVersionRef.current !== currentVersion) return;

        const mapped = mapSnapshot(snapshot);

        if (isRefresh) {
          setData(mapped as T);
        } else {
          setData((prev) => [...prev, ...(mapped as T)] as T);
        }

        const docs = snapshot.docs;
        if (docs.length > 0) {
          lastDocRef.current = docs[docs.length - 1];
        }
        setHasMore(docs.length === pageSize);
      } catch (err) {
        if (isMountedRef.current && fetchVersionRef.current === currentVersion) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (isMountedRef.current && fetchVersionRef.current === currentVersion && isRefresh) {
          setLoading(false);
        }
      }
    },
    [baseQuery, buildQuery, enabled, mapSnapshot, pageSize],
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current) return;
    setLoadingMore(true);
    setError(null);
    try {
      await fetchPage(lastDocRef.current, false);
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (isMountedRef.current) {
        setLoadingMore(false);
      }
    }
  }, [fetchPage, hasMore, loadingMore]);

  const refresh = useCallback(async () => {
    if (!baseQuery || !enabled) return;
    lastDocRef.current = null;
    await fetchPage(null, true);
  }, [baseQuery, enabled, fetchPage]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchVersionRef.current += 1;

    if (!baseQuery || !enabled) {
      setData([] as unknown as T);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(true);
      lastDocRef.current = null;
      return () => {
        isMountedRef.current = false;
      };
    }

    lastDocRef.current = null;
    void fetchPage(null, true);

    return () => {
      isMountedRef.current = false;
      fetchVersionRef.current += 1;
    };
  }, [baseQuery, enabled, fetchPage]);

  return {
    data,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
