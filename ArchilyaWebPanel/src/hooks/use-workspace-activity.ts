"use client";

import { useCallback, useMemo } from "react";
import { collection, limit, orderBy, query, where, type QuerySnapshot } from "firebase/firestore";

import { usePaginatedFirestoreQuery } from "@/hooks/use-paginated-firestore-query";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { mapActivityLogDocument } from "@/lib/activity/mapper";
import type { ActivityLogRecord } from "@/lib/activity/types";
import { getFirebaseFirestore } from "@/lib/firebase/client";

import { useWorkspace } from "./use-workspace";

const RECENT_ACTIVITY_LIMIT = 5;
const ACTIVITY_PAGE_SIZE = 20;

export function useWorkspaceActivity() {
  const { activeWorkspace } = useWorkspace();
  const db = getFirebaseFirestore();

  const baseQuery = useMemo(
    () => (activeWorkspace?.id
      ? query(
          collection(db, "workspaceActivityLogs"),
          where("workspaceId", "==", activeWorkspace.id),
        )
      : null),
    [activeWorkspace?.id, db],
  );

  const recentQuery = useMemo(
    () => (activeWorkspace?.id
      ? query(
          collection(db, "workspaceActivityLogs"),
          where("workspaceId", "==", activeWorkspace.id),
          orderBy("timestamp", "desc"),
          limit(RECENT_ACTIVITY_LIMIT),
        )
      : null),
    [activeWorkspace?.id, db],
  );

  const mapSnapshot = useCallback((snapshot: QuerySnapshot) => {
    return snapshot.docs.map((docSnap) => mapActivityLogDocument(docSnap.id, docSnap.data()));
  }, []);

  const {
    data: logs,
    loading,
    hasMore,
    loadMore,
    refresh,
  } = usePaginatedFirestoreQuery<ActivityLogRecord[]>({
    baseQuery,
    orderByField: "timestamp",
    orderDirection: "desc",
    pageSize: ACTIVITY_PAGE_SIZE,
    mapSnapshot,
    enabled: Boolean(activeWorkspace?.id),
  });

  const {
    data: recentLogs,
    loading: recentLoading,
  } = useFirestoreQuery<ActivityLogRecord[]>({
    queryRef: recentQuery,
    initialData: [],
    mapSnapshot,
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
