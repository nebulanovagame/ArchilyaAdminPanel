"use client";

import { useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";

import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { createActivityLogEntry } from "@/lib/activity/service";
import type { ActivityAction, ActivityCategory } from "@/lib/activity/types";
import { mapProjectDocument } from "@/lib/projects/mapper";
import {
  batchSoftDeleteProjects,
  createProject,
  softDeleteProject,
} from "@/lib/projects/service";
import type { CreateProjectInput } from "@/lib/projects/types";

export function useProjects(
  uid: string | null,
  ownerEmail: string | null,
  ownerName: string,
  canMutate: boolean,
  mutationErrorMessage: string,
  workspaceId?: string | null,
) {
  const t = useTranslations();

  const mapRows = useCallback((rows: Record<string, unknown>[]) => {
    return rows.map((row) => mapProjectDocument(String(row.id), row));
  }, []);

  // Note: projects table uses owner_id (not uid).
  // Projects where the user is a team member (not owner) are queried
  // via project_team_members join in the service layer instead.
  const filters = useMemo(() => {
    return uid
      ? [{ column: "owner_id", value: uid }, { column: "is_deleted", value: false }]
      : [];
  }, [uid]);

  const {
    data: projects,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refresh,
  } = usePaginatedQuery({
    table: "projects",
    filters,
    orderByField: "created_at",
    orderDirection: "desc",
    pageSize: 10,
    mapRows,
    enabled: Boolean(uid),
  });

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
      await createActivityLogEntry(null, {
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
      void logActivity("project", "softDeleteProject", "project", projectIds.join(","), `${projectIds.length} proje`, { count: projectIds.length });
      await refresh();
    },
  };
}
