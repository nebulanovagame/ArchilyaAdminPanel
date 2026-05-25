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

