export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;


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


export function getFileStableId(file: ProjectFileRecord) {
  if (file.url) return file.url;
  if (file.path) return file.path;
  if (file.objectKey) return `r2://${file.objectKey}`;
  return `${file.name}-${file.createdAt || ""}-${file.size || 0}`;
}

