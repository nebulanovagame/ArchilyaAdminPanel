import { logger } from "firebase-functions";
import type { Storage } from "firebase-admin/storage";

const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface CleanupFailure {
  scope: "expired-project" | "project-file" | "orphaned-file" | "active-project";
  projectId?: string;
  path?: string;
  message: string;
}

export interface CleanupSummary {
  expiredProjectsDeleted: number;
  projectFilesDeleted: number;
  orphanedFilesDeleted: number;
  docsUpdated: number;
  failures: CleanupFailure[];
}

interface TimestampLike {
  toDate: () => Date;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasToDate(value: unknown): value is TimestampLike {
  return isRecord(value) && typeof value.toDate === "function";
}

function toValidDate(dateValue: unknown): Date | null {
  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  if (hasToDate(dateValue)) {
    const converted = dateValue.toDate();
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  if (typeof dateValue === "string" || typeof dateValue === "number") {
    const converted = new Date(dateValue);
    return Number.isNaN(converted.getTime()) ? null : converted;
  }

  return null;
}

function getPath(value: unknown): string | null {
  if (!isRecord(value) || typeof value.path !== "string") {
    return null;
  }

  const trimmedPath = value.path.trim();
  return trimmedPath.length > 0 ? trimmedPath : null;
}

function addPath(paths: Set<string>, value: unknown): void {
  const path = getPath(value);

  if (path !== null) {
    paths.add(path);
  }
}

function collectVersionPaths(paths: Set<string>, fileValue: unknown): void {
  if (!isRecord(fileValue) || !Array.isArray(fileValue.versions)) {
    return;
  }

  for (const version of fileValue.versions) {
    addPath(paths, version);
  }
}

function collectFileStoragePaths(fileValue: unknown): string[] {
  const paths = new Set<string>();
  addPath(paths, fileValue);
  collectVersionPaths(paths, fileValue);
  return [...paths];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isMissingStorageObjectError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return error.code === 404 || error.code === "404";
}

function getExpectedProjectPathPrefix(projectId: string, projectData: Record<string, unknown>): string | null {
  if (typeof projectData.uid !== "string") {
    return null;
  }

  const ownerUid = projectData.uid.trim();
  return ownerUid.length > 0 ? `users/${ownerUid}/projects/${projectId}/` : null;
}

function isValidProjectStoragePath(path: string, expectedPrefix: string): boolean {
  if (path.startsWith("/") || path.includes("\\") || /[\u0000-\u001F\u007F]/u.test(path)) {
    return false;
  }

  if (path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) {
    return false;
  }

  return path.startsWith(expectedPrefix);
}

export function isOlderThanRetention(dateValue: unknown): boolean {
  const date = toValidDate(dateValue);

  if (date === null) {
    return false;
  }

  return date.getTime() < Date.now() - RETENTION_MS;
}

export function collectStoragePaths(projectData: Record<string, unknown>): string[] {
  const paths = new Set<string>();

  if (Array.isArray(projectData.files)) {
    for (const file of projectData.files) {
      for (const path of collectFileStoragePaths(file)) {
        paths.add(path);
      }
    }
  }

  if (Array.isArray(projectData.deletedFiles)) {
    for (const deletedFile of projectData.deletedFiles) {
      for (const path of collectFileStoragePaths(deletedFile)) {
        paths.add(path);
      }
    }
  }

  return [...paths];
}

export async function deleteStoragePath(storage: Storage, path: string): Promise<void> {
  try {
    await storage.bucket().file(path).delete();
  } catch (error) {
    if (isMissingStorageObjectError(error)) {
      return;
    }

    throw error;
  }
}

export async function performCleanup(
  firestore: FirebaseFirestore.Firestore,
  storage: Storage,
): Promise<CleanupSummary> {
  const summary: CleanupSummary = {
    expiredProjectsDeleted: 0,
    projectFilesDeleted: 0,
    orphanedFilesDeleted: 0,
    docsUpdated: 0,
    failures: [],
  };

  const cutoffDate = new Date(Date.now() - RETENTION_MS);
  const expiredProjectsSnapshot = await firestore
    .collection("projects")
    .where("isDeleted", "==", true)
    .where("deletedAt", "<", cutoffDate)
    .get();

  for (const projectDoc of expiredProjectsSnapshot.docs) {
    const projectData = projectDoc.data();
    const storagePaths = collectStoragePaths(projectData);
    const expectedPathPrefix = getExpectedProjectPathPrefix(projectDoc.id, projectData);
    let projectHasStorageFailures = false;

    for (const path of storagePaths) {
      if (expectedPathPrefix === null || !isValidProjectStoragePath(path, expectedPathPrefix)) {
        projectHasStorageFailures = true;
        summary.failures.push({
          scope: "project-file",
          projectId: projectDoc.id,
          path,
          message: "Storage path is outside the expected project namespace.",
        });
        continue;
      }

      try {
        await deleteStoragePath(storage, path);
        summary.projectFilesDeleted += 1;
      } catch (error) {
        projectHasStorageFailures = true;
        summary.failures.push({
          scope: "project-file",
          projectId: projectDoc.id,
          path,
          message: getErrorMessage(error),
        });
      }
    }

    if (projectHasStorageFailures) {
      logger.warn("Skipped expired project document delete because storage cleanup failed", {
        projectId: projectDoc.id,
      });
      continue;
    }

    try {
      await projectDoc.ref.delete();
      summary.expiredProjectsDeleted += 1;
    } catch (error) {
      summary.failures.push({
        scope: "expired-project",
        projectId: projectDoc.id,
        message: getErrorMessage(error),
      });
    }
  }

  const activeProjectsSnapshot = await firestore
    .collection("projects")
    .where("isDeleted", "==", false)
    .get();

  for (const projectDoc of activeProjectsSnapshot.docs) {
    const projectData = projectDoc.data();
    const expectedPathPrefix = getExpectedProjectPathPrefix(projectDoc.id, projectData);

    if (!Array.isArray(projectData.deletedFiles)) {
      continue;
    }

    const retainedDeletedFiles: unknown[] = [];
    let removedDeletedFiles = 0;

    for (const deletedFile of projectData.deletedFiles) {
      const expired = isRecord(deletedFile) && isOlderThanRetention(deletedFile.deletedAt);

      if (!expired) {
        retainedDeletedFiles.push(deletedFile);
        continue;
      }

      const paths = collectFileStoragePaths(deletedFile);
      let deleteFailed = false;

      for (const path of paths) {
        if (expectedPathPrefix === null || !isValidProjectStoragePath(path, expectedPathPrefix)) {
          deleteFailed = true;
          summary.failures.push({
            scope: "orphaned-file",
            projectId: projectDoc.id,
            path,
            message: "Storage path is outside the expected project namespace.",
          });
          continue;
        }

        try {
          await deleteStoragePath(storage, path);
          summary.orphanedFilesDeleted += 1;
        } catch (error) {
          deleteFailed = true;
          summary.failures.push({
            scope: "orphaned-file",
            projectId: projectDoc.id,
            path,
            message: getErrorMessage(error),
          });
        }
      }

      if (deleteFailed) {
        retainedDeletedFiles.push(deletedFile);
      } else {
        removedDeletedFiles += 1;
      }
    }

    if (removedDeletedFiles === 0) {
      continue;
    }

    try {
      await projectDoc.ref.update({ deletedFiles: retainedDeletedFiles });
      summary.docsUpdated += 1;
    } catch (error) {
      summary.failures.push({
        scope: "active-project",
        projectId: projectDoc.id,
        message: getErrorMessage(error),
      });
    }
  }

  logger.info("Deleted project data cleanup completed", summary);
  return summary;
}
