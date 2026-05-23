export type ProjectColorLabel = 'Acil' | 'Revizyon' | 'Onaylandı' | 'Beklemede' | 'Demo';

export type ProjectTab = 'all' | 'starred' | 'recent';

export type ProjectSortMode = 'lastOpened' | 'nameAsc' | 'status' | 'lastSync';

export type ProjectViewMode = 'grid' | 'list';

export interface ProjectCenterProject {
  id: string;
  name: string;
  coverGradient: string;
  status: 'Aktif' | 'Taslak' | 'İncelemede' | 'Tamamlandı';
  projectType: 'UE5' | 'CAD' | '3D' | 'Other';
  fileCount: number;
  sizeLabel: string;
  lastSync: string;
  lastOpenedAt: string;
  isFavorite: boolean;
  colorLabel?: ProjectColorLabel;
}
