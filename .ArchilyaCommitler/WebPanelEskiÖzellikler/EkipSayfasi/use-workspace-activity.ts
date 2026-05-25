"use client";

import { useCallback, useMemo } from "react";

import { usePaginatedFirestoreQuery } from "@/hooks/use-paginated-firestore-query";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { mapActivityLogDocument } from "@/lib/activity/mapper";
import type { ActivityLogRecord } from "@/lib/activity/types";
import { createClient } from "@/lib/supabase/client";

import { useWorkspace } from "./use-workspace";

const ACTIVITY_PAGE_SIZE = 20;

export function useWorkspaceActivity() {
  const { activeWorkspace } = useWorkspace();

  const mapRows = useCallback((rows: Record<string, unknown>[]) => {
    return rows.map((row) => mapActivityLogDocument(String(row.id), row));
  }, []);

  const workspaceId = activeWorkspace?.id ?? "";

  const filters = useMemo(() => {
    if (!workspaceId) return [];
    return [{ column: "workspace_id", value: workspaceId }];
  }, [workspaceId]);

  const {
    data: logs,
    loading,
    hasMore,
    loadMore,
    refresh,
  } = usePaginatedFirestoreQuery<ActivityLogRecord[]>({
    table: "workspace_activity_logs",
    filters,
    orderByField: "created_at",
    orderDirection: "desc",
    pageSize: ACTIVITY_PAGE_SIZE,
    mapRows,
    enabled: Boolean(activeWorkspace?.id),
  });

  const recentQueryFn = useCallback(async () => {
    if (!workspaceId) return { data: [] as ActivityLogRecord[], error: null };

    const supabase = createClient();
    const { data, error } = await supabase
      .from("workspace_activity_logs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) return { data: [] as ActivityLogRecord[], error: { message: error.message } };

    return {
      data: (data ?? []).map((row) => mapActivityLogDocument(String(row.id), row as Record<string, unknown>)),
      error: null,
    };
  }, [workspaceId]);

  const {
    data: recentLogs,
    loading: recentLoading,
  } = useFirestoreQuery<ActivityLogRecord[]>({
    queryKey: `recent-activity-${activeWorkspace?.id || "none"}`,
    queryFn: recentQueryFn,
    initialData: [],
    enabled: Boolean(activeWorkspace?.id),
  });

  return {
    logs,
    loading,
    hasMore,
    loadMore,
    refresh,
    recentLogs,
    recentLoading,
  };
}
