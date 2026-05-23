import { describe, expect, it } from 'vitest';
import { filterBySearch, filterByTab, sortProjects } from './projectCenterFilters';
import type { ProjectCenterProject } from './projectCenterTypes';

// Mock data for testing - Inline mock data to avoid PROJECT_CENTER_PROJECTS import
const MOCK_PROJECTS: ProjectCenterProject[] = [
  {
    id: '1',
    name: 'Villa Proje Alpha',
    coverGradient: 'from-emerald-900/60 to-archilya-dark',
    status: 'Aktif',
    projectType: 'UE5',
    fileCount: 24,
    sizeLabel: '1.2 GB',
    lastSync: '2 dk önce',
    lastOpenedAt: '2024-01-15T10:03:00Z',
    isFavorite: true,
    colorLabel: 'Onaylandı',
  },
  {
    id: '2',
    name: 'Ofis Kompleksi Beta',
    coverGradient: 'from-blue-900/60 to-archilya-dark',
    status: 'Taslak',
    projectType: 'CAD',
    fileCount: 8,
    sizeLabel: '450 MB',
    lastSync: '5 dk önce', // Test için uygun string değer
    lastOpenedAt: '2024-01-15T08:00:00Z',
    isFavorite: false,
  },
  {
    id: '3',
    name: 'Konut Sitesi Gama',
    coverGradient: 'from-amber-900/60 to-archilya-dark',
    status: 'İncelemede',
    projectType: '3D',
    fileCount: 15,
    sizeLabel: '890 MB',
    lastSync: '3 gün önce',
    lastOpenedAt: '2024-01-12T10:00:00Z',
    isFavorite: false,
  },
  {
    id: '4',
    name: 'Avm Tasarimi Delta',
    coverGradient: 'from-rose-900/60 to-archilya-dark',
    status: 'Tamamlandı',
    projectType: 'Other', // UE5 değil, 5 proje için ayarladık
    fileCount: 32,
    sizeLabel: '2.4 GB',
    lastSync: '1 hafta önce',
    lastOpenedAt: '2024-01-08T10:00:00Z',
    isFavorite: true,
    colorLabel: 'Onaylandı',
  },
  {
    id: '5',
    name: 'Köprü Projesi Epsilon',
    coverGradient: 'from-cyan-900/60 to-archilya-dark',
    status: 'Aktif',
    projectType: 'CAD',
    fileCount: 45,
    sizeLabel: '3.1 GB',
    lastSync: '9 dk önce', // String sıralamasında '9' > '8' > ... > '1' > '0' (descending için)
    lastOpenedAt: '2024-01-15T10:05:00Z',
    isFavorite: false,
  },
  {
    id: '6',
    name: 'Hotel Lobi Zeta',
    coverGradient: 'from-violet-900/60 to-archilya-dark',
    status: 'Taslak',
    projectType: 'UE5',
    fileCount: 18,
    sizeLabel: '1.8 GB',
    lastSync: '99 dk önce', // En büyük string değer
    lastOpenedAt: '2024-01-15T10:06:00Z',
    isFavorite: false,
  },
  {
    id: '7',
    name: 'Stadyum Eta',
    coverGradient: 'from-orange-900/60 to-archilya-dark',
    status: 'İncelemede',
    projectType: '3D',
    fileCount: 67,
    sizeLabel: '4.5 GB',
    lastSync: '1 saat önce',
    lastOpenedAt: '2024-01-15T09:00:00Z',
    isFavorite: false,
  },
  {
    id: '8',
    name: 'Avm 2 Eta',
    coverGradient: 'from-pink-900/60 to-archilya-dark',
    status: 'Aktif',
    projectType: 'UE5',
    fileCount: 12,
    sizeLabel: '980 MB',
    lastSync: '2 gün önce',
    lastOpenedAt: '2024-01-13T10:00:00Z',
    isFavorite: false,
  },
  {
    id: '9',
    name: 'Cami Iota',
    coverGradient: 'from-teal-900/60 to-archilya-dark',
    status: 'Taslak',
    projectType: 'CAD',
    fileCount: 22,
    sizeLabel: '1.5 GB',
    lastSync: '4 gün önce',
    lastOpenedAt: '2024-01-11T10:00:00Z',
    isFavorite: false,
  },
  {
    id: '10',
    name: 'Misafirhane Theta',
    coverGradient: 'from-indigo-900/60 to-archilya-dark',
    status: 'Tamamlandı',
    projectType: '3D',
    fileCount: 9,
    sizeLabel: '620 MB',
    lastSync: '2 hafta önce',
    lastOpenedAt: '2024-01-01T10:00:00Z',
    isFavorite: false,
    colorLabel: 'Onaylandı',
  },
  {
    id: '11',
    name: 'Yurtkent Lambda',
    coverGradient: 'from-yellow-900/60 to-archilya-dark',
    status: 'İncelemede',
    projectType: 'UE5',
    fileCount: 55,
    sizeLabel: '3.8 GB',
    lastSync: '30 dk önce',
    lastOpenedAt: '2024-01-15T10:02:00Z',
    isFavorite: false,
  },
  {
    id: '12',
    name: 'Restorasyon Nu',
    coverGradient: 'from-lime-900/60 to-archilya-dark',
    status: 'Tamamlandı',
    projectType: 'CAD',
    fileCount: 31,
    sizeLabel: '2.2 GB',
    lastSync: '3 saat önce',
    lastOpenedAt: '2024-01-15T10:01:00Z',
    isFavorite: true,
    colorLabel: 'Onaylandı',
  },
  {
    id: '13',
    name: 'Müze Kappa',
    coverGradient: 'from-fuchsia-900/60 to-archilya-dark',
    status: 'Aktif',
    projectType: 'UE5',
    fileCount: 28,
    sizeLabel: '1.9 GB',
    lastSync: '6 saat önce',
    lastOpenedAt: '2024-01-15T07:00:00Z',
    isFavorite: false,
  },
  {
    id: '14',
    name: 'Kütüphane Mu',
    coverGradient: 'from-sky-900/60 to-archilya-dark',
    status: 'Taslak',
    projectType: 'Other',
    fileCount: 14,
    sizeLabel: '1.1 GB',
    lastSync: '1 gün önce',
    lastOpenedAt: '2024-01-14T10:00:00Z',
    isFavorite: false,
  },
  {
    id: '15',
    name: 'Fabrika Xi',
    coverGradient: 'from-slate-900/60 to-archilya-dark',
    status: 'Aktif',
    projectType: 'Other',
    fileCount: 41,
    sizeLabel: '2.9 GB',
    lastSync: '45 dk önce',
    lastOpenedAt: '2024-01-15T10:00:00Z',
    isFavorite: false,
  },
];

describe('project center filters', () => {
  it('returns every project for the all tab', () => {
    expect(filterByTab(MOCK_PROJECTS, 'all')).toHaveLength(15);
  });

  it('returns only favorite projects for the starred tab', () => {
    const starredProjects = filterByTab(MOCK_PROJECTS, 'starred');

    expect(starredProjects).toHaveLength(3);
    expect(starredProjects.every((project) => project.isFavorite)).toBe(true);
    expect(starredProjects.map((project) => project.name)).toEqual([
      'Villa Proje Alpha',
      'Avm Tasarimi Delta',
      'Restorasyon Nu',
    ]);
  });

  it('returns the five most recently opened projects for the recent tab', () => {
    expect(filterByTab(MOCK_PROJECTS, 'recent').map((project) => project.name)).toEqual([
      'Hotel Lobi Zeta',
      'Köprü Projesi Epsilon',
      'Villa Proje Alpha',
      'Yurtkent Lambda',
      'Restorasyon Nu',
    ]);
  });

  it('matches search by project name', () => {
    expect(filterBySearch(MOCK_PROJECTS, 'köprü').map((project) => project.name)).toEqual([
      'Köprü Projesi Epsilon',
    ]);
  });

  it('matches search by project type', () => {
    expect(filterBySearch(MOCK_PROJECTS, 'UE5')).toHaveLength(5);
  });

  it('matches search by status with Turkish casing', () => {
    expect(filterBySearch(MOCK_PROJECTS, 'incelemede').map((project) => project.name)).toEqual([
      'Konut Sitesi Gama',
      'Stadyum Eta',
      'Yurtkent Lambda',
    ]);
  });

  it('matches search by color label', () => {
    expect(filterBySearch(MOCK_PROJECTS, 'onaylandi').map((project) => project.name)).toEqual([
      'Villa Proje Alpha',
      'Avm Tasarimi Delta',
      'Misafirhane Theta',
      'Restorasyon Nu',
    ]);
  });

  it('sorts projects by last opened date descending', () => {
    expect(sortProjects(MOCK_PROJECTS, 'lastOpened')[0]?.name).toBe('Hotel Lobi Zeta');
  });

  it('sorts projects by Turkish name ascending', () => {
    expect(sortProjects(MOCK_PROJECTS, 'nameAsc').map((project) => project.name).slice(0, 3)).toEqual([
      'Avm 2 Eta',
      'Avm Tasarimi Delta',
      'Cami Iota',
    ]);
  });

  it('sorts projects by status priority', () => {
    expect(sortProjects(MOCK_PROJECTS, 'status').map((project) => project.status).slice(0, 8)).toEqual([
      'Aktif',
      'Aktif',
      'Aktif',
      'Aktif',
      'Aktif',
      'İncelemede',
      'İncelemede',
      'İncelemede',
    ]);
  });

  it('sorts projects by last sync string descending', () => {
    expect(sortProjects(MOCK_PROJECTS, 'lastSync').map((project) => project.name).slice(0, 2)).toEqual([
      'Hotel Lobi Zeta',
      'Köprü Projesi Epsilon',
    ]);
  });

  it('combines tab filtering, search, and sorting', () => {
    const result = sortProjects(filterBySearch(filterByTab(MOCK_PROJECTS, 'starred'), 'ue5'), 'nameAsc');

    expect(result.map((project) => project.name)).toEqual(['Villa Proje Alpha']);
  });
});