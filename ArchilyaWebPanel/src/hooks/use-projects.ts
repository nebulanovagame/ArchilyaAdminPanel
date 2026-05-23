"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { collection, query, where, type Query, type QuerySnapshot } from "firebase/firestore";

import { usePaginatedFirestoreQuery } from "@/hooks/use-paginated-firestore-query";
import { createActivityLogEntry } from "@/lib/activity/service";
import type { ActivityAction, ActivityCategory } from "@/lib/activity/types";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { projectConverter } from "@/lib/projects/mapper";
import { getOverviewStats } from "@/lib/projects/model";
import {
  batchSoftDeleteProjects,
  createProject,
  softDeleteProject,
} from "@/lib/projects/service";
import type { CreateProjectInput, ProjectRecord } from "@/lib/projects/types";

export function useProjects(
  uid: string | null,
  ownerEmail: string | null,
  ownerName: string,
  canMutate: boolean,
  mutationErrorMessage: string,
  workspaceId?: string | null,
) {
  const t = useTranslations();
  const baseQuery = useMemo<Query<ProjectRecord> | null>(
    () => (uid ? query(collection(getFirebaseFirestore(), "projects").withConverter(projectConverter), where("memberUids", "array-contains", uid)) : null),
    [uid],
  );

  const mapSnapshot = useCallback((snapshot: QuerySnapshot<ProjectRecord>) => {
    return snapshot.docs
      .map((docSnap) => docSnap.data())
      .filter((project) => !project.isDeleted);
  }, []);

  const {
    data: projects,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  } = usePaginatedFirestoreQuery({
    baseQuery,
    orderByField: "createdAt",
    orderDirection: "desc",
    pageSize: 10,
    mapSnapshot,
    enabled: Boolean(uid),
  });

  const stats = useMemo(() => getOverviewStats(projects), [projects]);

  async function logActivity(
    category: ActivityCategory,
    action: ActivityAction,
    targetType: string,
    targetId: string,
    targetName: string,
    metadata: Record<string, unknown> = {},
  ) {
    if (!uid || !workspaceId || !ownerEmail) return;
    try {
      await createActivityLogEntry(getFirebaseFirestore(), {
        workspaceId,
        category,
        action,
        actorUid: uid,
        actorEmail: ownerEmail,
        actorName: ownerName || ownerEmail,
        targetType,
        targetId,
        targetName,
        metadata,
        timestamp: null,
      });
    } catch {
      // Silently fail
    }
  }

  return {
    projects,
    stats,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
    createProject: async (input: CreateProjectInput) => {
      if (!uid) throw new Error(t("errors.sessionMissing"));
      if (!canMutate) throw new Error(mutationErrorMessage);
      const record = await createProject(uid, ownerEmail, ownerName, input);
      void logActivity("project", "createProject", "project", record.id, input.name, { location: input.location });
    },
    softDeleteProject: async (projectId: string) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      await softDeleteProject(projectId);
      void logActivity("project", "softDeleteProject", "project", projectId, projectId, {});
    },
    batchSoftDelete: async (projectIds: string[]) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      await batchSoftDeleteProjects(projectIds);
      void logActivity("project", "softDeleteProject", "project", projectIds.join(","), t("dashboard.trash.projectsTab", { count: projectIds.length }), { count: projectIds.length });
      await refresh();
    },
  };
}
