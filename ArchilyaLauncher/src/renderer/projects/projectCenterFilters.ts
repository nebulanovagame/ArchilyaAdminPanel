import type { ProjectCenterProject, ProjectSortMode, ProjectTab } from './projectCenterTypes';

const STATUS_ORDER: Record<ProjectCenterProject['status'], number> = {
  Aktif: 0,
  İncelemede: 1,
  Taslak: 2,
  Tamamlandı: 3,
};

const normalizeSearchText = (value: string) =>
  value
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i');

export const filterByTab = (projects: ProjectCenterProject[], tab: ProjectTab): ProjectCenterProject[] => {
  if (tab === 'starred') {
    return projects.filter((project) => project.isFavorite);
  }

  if (tab === 'recent') {
    return sortProjects(projects, 'lastOpened').slice(0, 5);
  }

  return [...projects];
};

export const filterBySearch = (projects: ProjectCenterProject[], query: string): ProjectCenterProject[] => {
  const normalizedQuery = normalizeSearchText(query.trim());

  if (!normalizedQuery) {
    return [...projects];
  }

  return projects.filter((project) => {
    const searchableValues = [project.name, project.projectType, project.status, project.colorLabel ?? ''];

    return searchableValues.some((value) => normalizeSearchText(value).includes(normalizedQuery));
  });
};

export const sortProjects = (
  projects: ProjectCenterProject[],
  sortMode: ProjectSortMode,
): ProjectCenterProject[] => {
  const sortedProjects = [...projects];

  switch (sortMode) {
    case 'lastOpened':
      return sortedProjects.sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    case 'nameAsc':
      return sortedProjects.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    case 'status':
      return sortedProjects.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    case 'lastSync':
      return sortedProjects.sort((a, b) => b.lastSync.localeCompare(a.lastSync));
    default:
      return sortedProjects;
  }
};
