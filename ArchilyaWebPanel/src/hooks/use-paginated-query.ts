/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type UsePaginatedQueryOptions<T> = {
  table: string;
  filters: Array<{ column: string; value: string | boolean | number }>;
  orderByField: string;
  orderDirection?: "desc" | "asc";
  pageSize?: number;
  mapRows: (rows: Record<string, unknown>[]) => T;
  enabled?: boolean;
};

export type UsePaginatedQueryResult<T> = {
  data: T;
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
};

export function usePaginatedQuery<T extends unknown[]>({
  table,
  filters,
  orderByField,
  orderDirection = "desc",
  pageSize = 10,
  mapRows,
  enabled = true,
}: UsePaginatedQueryOptions<T>): UsePaginatedQueryResult<T> {
  const [data, setData] = useState<T>([] as unknown as T);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const isMountedRef = useRef(true);
  const fetchVersionRef = useRef(0);

  const fetchPage = useCallback(
    async (append = false) => {
      if (!enabled) return;

      const supabase = createClient();
      const version = ++fetchVersionRef.current;

      let query = supabase
        .from(table)
        .select("*")
        .order(orderByField, { ascending: orderDirection === "asc" })
        .range(offsetRef.current, offsetRef.current + pageSize - 1);

      for (const filter of filters) {
        query = query.eq(filter.column, filter.value);
      }

      const { data: rows, error: err } = await query;

      if (!isMountedRef.current || fetchVersionRef.current !== version) return;

      if (err) {
        setError(new Error(err.message));
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const mapped = mapRows(rows || []);
      const hasMoreRows = (rows || []).length === pageSize;

      if (append) {
        setData((prev) => [...(prev as unknown as unknown[]), ...(mapped as unknown as unknown[])] as T);
      } else {
        setData(mapped as T);
      }

      setHasMore(hasMoreRows);
      setError(null);
      setLoading(false);
      setLoadingMore(false);
    },
    [enabled, table, filters, orderByField, orderDirection, pageSize, mapRows],
  );

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    offsetRef.current += pageSize;
    setLoadingMore(true);
    void fetchPage(true);
  }, [fetchPage, loadingMore, hasMore, pageSize]);

  const refresh = useCallback(() => {
    offsetRef.current = 0;
    setLoading(true);
    void fetchPage(false);
  }, [fetchPage]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchVersionRef.current += 1;

    if (!enabled) {
      setData([] as unknown as T);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(true);
      offsetRef.current = 0;
      return () => {
        isMountedRef.current = false;
      };
    }

    offsetRef.current = 0;
    setLoading(true);
    void fetchPage(false);

    return () => {
      isMountedRef.current = false;
      fetchVersionRef.current += 1;
    };
  }, [enabled, fetchPage]);

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
