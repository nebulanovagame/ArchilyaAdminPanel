"use client";

import * as Sentry from "@sentry/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

const RETRY_BACKOFF_MS = [500, 1000, 2000];
const DEFAULT_POLLING_INTERVAL_MS = 5000;
const POLLING_ERROR_BACKOFF_MS = 2;
const MAX_POLLING_INTERVAL_MS = 30000;

// Module-level counter for unique Realtime channel names across component mounts.
// useRef resets on re-mount, causing name collisions with in-flight removeChannel().
let _globalChannelSeq = 0;

export type UseRealtimeDocOptions<T> = {
  table: string;
  id: string | null;
  initialData: T;
  mapRow: (row: Record<string, unknown>) => T;
  shouldPoll?: (data: T) => boolean;
  pollingIntervalMs?: number;
  retryOnPermissionDenied?: boolean;
  enabled?: boolean;
};

export function useRealtimeDoc<T>({
  table,
  id,
  initialData,
  mapRow,
  shouldPoll,
  pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS,
  retryOnPermissionDenied = true,
  enabled = true,
}: UseRealtimeDocOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(enabled && Boolean(id));
  const [error, setError] = useState<Error | null>(null);
  const retryCountRef = useRef(0);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const initialDataRef = useRef(initialData);
  const dataRef = useRef(initialData);

  const fetchDocRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    initialDataRef.current = initialData;
  });

  const updateData = useCallback((nextData: T) => {
    dataRef.current = nextData;
    setData(nextData);
  }, []);

  const fetchDoc = useCallback(async () => {
    if (!id) return;

    const supabase = createClient();
    const { data: row, error: err } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    if (err) {
      if (err.code === "PGRST116") {
        updateData(initialDataRef.current);
        setError(null);
        return;
      }

      if (retryOnPermissionDenied && err.message?.includes("permission") && retryCountRef.current < RETRY_BACKOFF_MS.length) {
        const delay = RETRY_BACKOFF_MS[retryCountRef.current];
        retryCountRef.current += 1;
        setTimeout(() => { void fetchDocRef.current(); }, delay);
        return;
      }

      Sentry.captureException(err, { tags: { supabase_table: table, supabase_id: id, retry_count: retryCountRef.current } });
      setError(new Error(err.message));
      return;
    }

    retryCountRef.current = 0;
    updateData(mapRow(row as Record<string, unknown>));
    setError(null);
  }, [id, table, mapRow, retryOnPermissionDenied, updateData]);

  useEffect(() => {
    fetchDocRef.current = fetchDoc;
  });

  // Effect: fetch initial data
  useEffect(() => {
    if (!enabled || !id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      updateData(initialDataRef.current);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetchDoc().then(() => {
      if (!cancelled) setLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err : new Error("Kayıt alınamadı."));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, id, fetchDoc, updateData]);

  // Effect: realtime subscription (separate to avoid race with StrictMode)
  useEffect(() => {
    if (!enabled || !id) {
      if (channelRef.current) {
        const supabase = createClient();
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Idempotent: remove existing channel before creating a new one
    if (channelRef.current) {
      const supabase = createClient();
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const supabase = createClient();
    const channelName = `${table}-doc-${id}-${_globalChannelSeq++}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `id=eq.${id}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            updateData(initialDataRef.current);
            return;
          }
          updateData(mapRow(payload.new as Record<string, unknown>));
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, id, table, mapRow, updateData]);

  // Effect: polling fallback for environments where Realtime does not deliver updates.
  // NOTE: `data` is intentionally omitted from deps — we read dataRef.current inside
  // the poll callback to avoid re-scheduling the polling loop on every data change.
  useEffect(() => {
    if (!enabled || !id || !shouldPoll || !shouldPoll(dataRef.current)) return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let nextDelay = Math.max(1000, pollingIntervalMs);

    const poll = async () => {
      if (cancelled || !shouldPoll(dataRef.current)) return;

      try {
        await fetchDocRef.current();
        nextDelay = Math.max(1000, pollingIntervalMs);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error("Kayıt güncellenemedi."));
        }
        nextDelay = Math.min(nextDelay * POLLING_ERROR_BACKOFF_MS, MAX_POLLING_INTERVAL_MS);
      }

      if (!cancelled && shouldPoll(dataRef.current)) {
        timeoutId = setTimeout(() => { void poll(); }, nextDelay);
      }
    };

    timeoutId = setTimeout(() => { void poll(); }, nextDelay);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, id, shouldPoll, pollingIntervalMs]);

  return { data, loading, error };
}
