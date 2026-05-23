/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, query, where, type Query, type QuerySnapshot } from "firebase/firestore";

import { usePaginatedFirestoreQuery } from "@/hooks/use-paginated-firestore-query";
import { createActivityLogEntry } from "@/lib/activity/service";
import type { ActivityAction, ActivityCategory } from "@/lib/activity/types";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { projectConverter } from "@/lib/projects/mapper";
import { shouldRetainTrashItem } from "@/lib/projects/model";
import {
  batchHardDeleteProjects,
  batchPermanentlyDeleteFiles,
  batchRestoreFiles,
  batchRestoreProjects,
  fetchTrashData,
  hardDeleteProject,
  permanentlyDeleteFile,
  restoreDeletedFile,
  restoreProject,
} from "@/lib/projects/service";
import type { ProjectFileRecord, ProjectRecord } from "@/lib/projects/types";

const FILES_PAGE_SIZE = 10;

export function useTrash(uid: string | null, canMutate: boolean, mutationErrorMessage: string, workspaceId?: string | null, ownerEmail?: string | null, ownerName?: string) {
  const baseQuery = useMemo<Query<ProjectRecord> | null>(
    () => (uid ? query(
      collection(getFirebaseFirestore(), "projects").withConverter(projectConverter),
      where("memberUids", "array-contains", uid),
      where("isDeleted", "==", true),
    ) : null),
    [uid],
  );

  const mapSnapshot = useCallback((snapshot: QuerySnapshot<ProjectRecord>) => {
    return snapshot.docs
      .map((docSnap) => docSnap.data())
      .filter((project) => project.uid === uid && shouldRetainTrashItem(project.deletedAt));
  }, [uid]);

  const {
    data: deletedProjects,
    loading: projectsLoading,
    loadingMore: projectsLoadingMore,
    error: projectsError,
    hasMore: projectsHasMore,
    loadMore: loadMoreProjects,
    refresh: refreshProjects,
  } = usePaginatedFirestoreQuery({
    baseQuery,
    orderByField: "deletedAt",
    orderDirection: "desc",
    pageSize: 10,
    mapSnapshot,
    enabled: Boolean(uid),
  });

  const [deletedFiles, setDeletedFiles] = useState<ProjectFileRecord[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesPage, setFilesPage] = useState(1);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<string[]>([]);

  const allFilesVisible = useMemo(() => {
    return deletedFiles.slice(0, filesPage * FILES_PAGE_SIZE);
  }, [deletedFiles, filesPage]);

  const filesHasMore = deletedFiles.length > allFilesVisible.length;

  const refreshFiles = useCallback(async () => {
    if (!uid) return;
    setFilesLoading(true);
    try {
      const { deletedFiles: nextFiles } = await fetchTrashData(uid);
      setDeletedFiles(nextFiles);
      setFilesPage(1);
    } finally {
      setFilesLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setDeletedFiles([]);
      setFilesPage(1);
      setFilesLoading(false);
      return;
    }

    void refreshFiles();
  }, [uid, refreshFiles]);

  const loadMoreFiles = useCallback(() => {
    setFilesPage((prev) => prev + 1);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([refreshProjects(), refreshFiles()]);
  }, [refreshProjects, refreshFiles]);

  const loading = projectsLoading || filesLoading;
  const error = projectsError;

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
    deletedProjects,
    deletedFiles: allFilesVisible,
    deletedFilesTotal: deletedFiles.length,
    loading,
    loadingMore: projectsLoadingMore,
    filesLoadingMore: filesLoading && !projectsLoading,
    error,
    hasMore: projectsHasMore,
    filesHasMore,
    loadMoreProjects,
    loadMoreFiles,
    refresh,
    processingId,
    processingIds,
    restoreProject: async (projectId: string) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      setProcessingId(projectId);
      setProcessingIds([projectId]);
      try {
        await restoreProject(projectId);
        void logActivity("project", "restoreProject", "project", projectId, projectId, {});
        await refresh();
      } finally {
        setProcessingId(null);
        setProcessingIds([]);
      }
    },
    permanentlyDeleteProject: async (project: ProjectRecord) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      setProcessingId(project.id);
      setProcessingIds([project.id]);
      try {
        await hardDeleteProject(project);
        void logActivity("project", "hardDeleteProject", "project", project.id, project.name, {});
        await refresh();
      } finally {
        setProcessingId(null);
        setProcessingIds([]);
      }
    },
    batchRestoreProjects: async (projectIds: string[]) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      setProcessingIds(projectIds);
      try {
        await batchRestoreProjects(projectIds);
        void logActivity("project", "restoreProject", "project", projectIds.join(","), `${projectIds.length} proje`, { count: projectIds.length });
        await refresh();
      } finally {
        setProcessingIds([]);
      }
    },
    batchPermanentlyDeleteProjects: async (projects: ProjectRecord[]) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      setProcessingIds(projects.map((project) => project.id));
      try {
        await batchHardDeleteProjects(projects);
        void logActivity("project", "hardDeleteProject", "project", projects.map((p) => p.id).join(","), `${projects.length} proje`, { count: projects.length });
        await refresh();
      } finally {
        setProcessingIds([]);
      }
    },
    restoreFile: async (projectId: string, file: ProjectFileRecord) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      const fileId = file.url || file.name;
      setProcessingId(fileId);
      setProcessingIds([fileId]);
      try {
        await restoreDeletedFile(projectId, file);
        void logActivity("file", "restoreFile", "file", fileId, file.name, { projectId });
        await refresh();
      } finally {
        setProcessingId(null);
        setProcessingIds([]);
      }
    },
    permanentlyDeleteFile: async (projectId: string, file: ProjectFileRecord) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      const fileId = file.url || file.name;
      setProcessingId(fileId);
      setProcessingIds([fileId]);
      try {
        await permanentlyDeleteFile(projectId, file);
        void logActivity("file", "permanentlyDeleteFile", "file", fileId, file.name, { projectId });
        await refresh();
      } finally {
        setProcessingId(null);
        setProcessingIds([]);
      }
    },
    batchRestoreFiles: async (items: Array<{ projectId: string; file: ProjectFileRecord }>) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      setProcessingIds(items.map((item) => item.file.url || item.file.name));
      try {
        await batchRestoreFiles(items);
        void logActivity("file", "restoreFile", "file", `${items.length} dosya`, `${items.length} dosya`, { count: items.length });
        await refresh();
      } finally {
        setProcessingIds([]);
      }
    },
    batchPermanentlyDeleteFiles: async (items: Array<{ projectId: string; file: ProjectFileRecord }>) => {
      if (!canMutate) throw new Error(mutationErrorMessage);
      setProcessingIds(items.map((item) => item.file.url || item.file.name));
      try {
        await batchPermanentlyDeleteFiles(items);
        void logActivity("file", "permanentlyDeleteFile", "file", `${items.length} dosya`, `${items.length} dosya`, { count: items.length });
        await refresh();
      } finally {
        setProcessingIds([]);
      }
    },
  };
}
