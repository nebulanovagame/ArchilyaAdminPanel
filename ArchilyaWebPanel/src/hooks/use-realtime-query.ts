"use client";

import { useEffect, useRef, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export type UseRealtimeQueryOptions<T> = {
  queryKey: string;
  queryFn: () => Promise<{ data: T | null; error: { message: string } | null }>;
  initialData: T;
  enabled?: boolean;
};

export function useRealtimeQuery<T>({ queryKey, queryFn, initialData, enabled = true }: UseRealtimeQueryOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const initialDataRef = useRef(initialData);

  useEffect(() => {
    initialDataRef.current = initialData;
  });

  // Effect: fetch initial data
  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      setData(initialDataRef.current);
      setError(null);
      return;
    }

    setLoading(true);

    void queryFn().then(({ data: result, error: err }) => {
      if (cancelled) return;
      if (err) {
        setError(new Error(err.message));
      } else {
        setData(result ?? initialDataRef.current);
        setError(null);
      }
      setLoading(false);
    }).catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err : new Error("Sorgu çalıştırılamadı."));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [enabled, queryFn]);

  // Effect: realtime subscription (separate to avoid race with StrictMode)
  useEffect(() => {
    if (!enabled) {
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
    const channel = supabase
      .channel(`query-${queryKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public" },
        () => {
          void queryFn().then(({ data: result, error: err }) => {
            if (!err && result !== null) {
              setData(result);
            }
          }).catch(() => undefined);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [enabled, queryKey, queryFn]);

  return { data, loading, error };
}
