import type { ProjectFileCount, ProjectFileRecord, ProjectRecord, OverviewStats } from "./types";

export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function getDefaultFileCount(): ProjectFileCount {
  return { pdf: 0, dwg: 0, img: 0 };
}

export function getFileTypeKey(fileNameOrType: string) {
  const value = fileNameOrType.toLowerCase();

  if (value.endsWith(".pdf") || value === "pdf") return "pdf" as const;
  if (
    value.endsWith(".dwg")
    || value.endsWith(".dxf")
    || value === "dwg"
    || value === "dxf"
  ) {
    return "dwg" as const;
  }

  return "img" as const;
}

export function getFileStableId(file: ProjectFileRecord) {
  if (file.url) return file.url;
  if (file.path) return file.path;
  if (file.objectKey) return `r2://${file.objectKey}`;
  return `${file.name}-${file.createdAt || ""}-${file.size || 0}`;
}

export function formatDateValue(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function getOverviewStats(projects: ProjectRecord[]): OverviewStats {
  const activeCount = projects.filter((project) => project.status === "Aktif").length;
  const totalProjectCount = projects.length;
  const totalFiles = projects.reduce(
    (sum, project) => sum + Object.values(project.fileCount || getDefaultFileCount()).reduce((acc, count) => acc + count, 0),
    0,
  );
  const totalSize = projects.reduce((sum, project) => sum + (project.totalSize || 0), 0);
  const uniqueMemberCount = new Set(projects.flatMap((project) => project.memberUids || [])).size || 1;

  return { activeCount, totalProjectCount, totalFiles, totalSize, uniqueMemberCount };
}

export function shouldRetainTrashItem(deletedAt: unknown) {
  const deletedDate = formatDateValue(deletedAt);
  if (!deletedDate) return true;
  return Date.now() - deletedDate.getTime() < THIRTY_DAYS_MS;
}

export function mapDeletedFiles(projects: ProjectRecord[]) {
  return projects.flatMap((project) =>
    (project.deletedFiles || [])
      .filter((file) => shouldRetainTrashItem(file.deletedAt))
      .map((file) => ({
        ...file,
        projectId: project.id,
        projectName: project.name,
      })),
  );
}
