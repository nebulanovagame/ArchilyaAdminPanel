import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ProjectGridCard } from '../components/ProjectGridCard';
import { ProjectListTable } from '../components/ProjectListTable';
import { filterByTab, filterBySearch, sortProjects } from '../projects/projectCenterFilters';
import type { ProjectTab, ProjectSortMode, ProjectViewMode, ProjectCenterProject } from '../projects/projectCenterTypes';
import type { UserData, FirebaseProject } from '../../shared/types';

const TAB_CONFIG: { id: ProjectTab; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'starred', label: 'Yıldızlılar' },
  { id: 'recent', label: 'Son Kullanılanlar' },
];

const SORT_CONFIG: { id: ProjectSortMode; label: string }[] = [
  { id: 'lastOpened', label: 'Son açılan' },
  { id: 'nameAsc', label: 'İsim (A-Z)' },
  { id: 'status', label: 'Durum' },
  { id: 'lastSync', label: 'Son senkronizasyon' },
];

// FirebaseProject'ten ProjectCenterProject'e dönüşüm
const convertFirebaseProjectToCenterProject = (
  firebaseProject: FirebaseProject,
  isFavorite: boolean
): ProjectCenterProject => {
  // Dosya boyutunu formatla
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Son senkronizasyon zamanını formatla
  const formatLastSync = (date: Date | string | null): string => {
    if (!date) return 'Bilinmiyor';
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    if (days < 30) return `${days} gün önce`;
    return d.toLocaleDateString('tr-TR');
  };

  // Proje tipini belirle
  const getProjectType = (): 'UE5' | 'CAD' | '3D' | 'Other' => {
    if (firebaseProject.pak_files && firebaseProject.pak_files.length > 0) return 'UE5';
    const files = firebaseProject.files || [];
    const hasCad = files.some(f => f.type?.toLowerCase().includes('dwg') || f.type?.toLowerCase().includes('dxf'));
    const has3D = files.some(f => f.type?.toLowerCase().includes('3ds') || f.type?.toLowerCase().includes('skp') || f.type?.toLowerCase().includes('fbx'));
    if (hasCad) return 'CAD';
    if (has3D) return '3D';
    return 'Other';
  };

  // Dosya sayısını hesapla
  const fileCount = firebaseProject.files?.filter(f => f.status !== 'trashed').length || 0;

  return {
    id: firebaseProject.id,
    name: firebaseProject.name,
    coverGradient: 'from-emerald-900/60 to-archilya-dark',
    status: firebaseProject.status,
    projectType: getProjectType(),
    fileCount,
    sizeLabel: formatSize(firebaseProject.totalSize || 0),
    lastSync: formatLastSync(firebaseProject.updatedAt),
    lastOpenedAt: firebaseProject.updatedAt instanceof Date 
      ? firebaseProject.updatedAt.toISOString() 
      : typeof firebaseProject.updatedAt === 'string' 
        ? firebaseProject.updatedAt 
        : new Date().toISOString(),
    isFavorite,
  };
};

interface ProjectsViewProps {
  onProjectSelect: (projectId: string, projectName: string) => void;
  user: UserData;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ onProjectSelect, user }) => {
  const [activeTab, setActiveTab] = useState<ProjectTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<ProjectSortMode>('lastOpened');
  const [viewMode, setViewMode] = useState<ProjectViewMode>('grid');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Firestore'dan gelen projeler
  const [projects, setProjects] = useState<FirebaseProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [filterDateRange, setFilterDateRange] = useState<string | null>(null);
  const [filterFileTypes, setFilterFileTypes] = useState<Set<string>>(new Set());
  const [filterSize, setFilterSize] = useState<string | null>(null);
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(new Set());
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  // Firestore subscription
  useEffect(() => {
    if (!user?.uid) return;

    setProjectsLoading(true);
    window.api.subscribeProjects(user.uid);

    const cleanProjects = window.api.onProjectsChanged((newProjects) => {
      setProjects(newProjects);
      setProjectsLoading(false);
      setProjectsError(null);
    });

    const cleanProjectsError = window.api.onProjectsError((err) => {
      console.error('Projects error:', err);
      setProjectsError(err);
      setProjectsLoading(false);
    });

    return () => {
      cleanProjects();
      cleanProjectsError();
      window.api.unsubscribeProjects();
    };
  }, [user?.uid]);

  // Filter click outside handler
  useEffect(() => {
    if (!isFilterOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isFilterOpen]);

  // Firebase projelerini ProjectCenterProject'e dönüştür
  const projectsWithFavorites = useMemo((): ProjectCenterProject[] => {
    return projects.map((project) =>
      convertFirebaseProjectToCenterProject(project, favorites.has(project.id))
    );
  }, [projects, favorites]);

  const filteredProjects = useMemo(() => {
    let result = filterByTab(projectsWithFavorites, activeTab);
    result = filterBySearch(result, searchQuery);

    if (filterStatuses.size > 0) {
      result = result.filter((p) => filterStatuses.has(p.status));
    }

    result = sortProjects(result, sortMode);
    return result;
  }, [projectsWithFavorites, activeTab, searchQuery, sortMode, filterStatuses]);

  const handleFavoriteToggle = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Loading skeleton
  if (projectsLoading) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="h-6 w-32 rounded skeleton-shimmer mb-2" />
            <div className="h-3 w-24 rounded skeleton-shimmer" />
          </div>
          <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
        </div>

        {/* Toolbar Skeleton */}
        <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
          <div className="flex-1 max-w-md h-9 rounded-lg skeleton-shimmer" />
          <div className="h-9 w-32 rounded-lg skeleton-shimmer" />
          <div className="h-9 w-20 rounded-lg skeleton-shimmer" />
          <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
        </div>

        {/* Tabs Skeleton */}
        <div className="flex items-center gap-1 mb-6 border-b border-white/[0.05] pb-2">
          <div className="h-9 w-20 rounded skeleton-shimmer mr-2" />
          <div className="h-9 w-24 rounded skeleton-shimmer mr-2" />
          <div className="h-9 w-28 rounded skeleton-shimmer" />
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] h-48 skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (projectsError) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
        <div className="flex flex-col items-center justify-center py-20">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500/50 mb-4">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-[14px] text-archilya-text-dim/70 tracking-wide mb-2">Projeler yüklenirken bir hata oluştu</p>
          <p className="text-[12px] text-archilya-text-dim/50">{projectsError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase">Projelerim</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.35em] text-archilya-gold/80">
            {filteredProjects.length} proje · {activeTab === 'all' ? 'Tümü' : activeTab === 'starred' ? 'Yıldızlılar' : 'Son Kullanılanlar'}
          </p>
        </div>
        <button className="flex items-center gap-2 text-[11px] font-display tracking-widest text-archilya-gold/80 hover:text-archilya-gold border border-archilya-gold/10 hover:border-archilya-gold/30 px-3 py-1.5 rounded transition-all duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          YENI PROJE
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-archilya-text-dim/40">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Proje ara..."
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[12px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:outline-none focus:border-archilya-gold/30 transition-colors"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as ProjectSortMode)}
            className="h-9 px-3 pr-8 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] text-archilya-text-dim/70 focus:outline-none focus:border-archilya-gold/30 transition-colors appearance-none cursor-pointer"
          >
            {SORT_CONFIG.map((sort) => (
              <option key={sort.id} value={sort.id}>{sort.label}</option>
            ))}
          </select>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-archilya-text-dim/40 pointer-events-none">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-white/[0.06] overflow-hidden">
          <button
            onClick={() => setViewMode('grid')}
            className={`w-9 h-9 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-white/[0.06] text-archilya-gold' : 'text-archilya-text-dim/40 hover:text-archilya-text/70 hover:bg-white/[0.03]'}`}
            title="Grid görünümü"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`w-9 h-9 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-white/[0.06] text-archilya-gold' : 'text-archilya-text-dim/40 hover:text-archilya-text/70 hover:bg-white/[0.03]'}`}
            title="Liste görünümü"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>

        {/* Advanced Filter */}
        <div ref={filterRef} className="relative">
          <button
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            className={`h-9 shrink-0 rounded-lg border px-3 text-[11px] font-display tracking-widest transition-colors flex items-center gap-2 ${
              activeFilterCount > 0
                ? 'border-archilya-gold/25 bg-archilya-gold/[0.08] text-archilya-gold'
                : 'border-white/[0.06] bg-white/[0.03] text-archilya-text-dim/70 hover:border-archilya-gold/25 hover:text-archilya-gold'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
            Gelişmiş Filtre
            {activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-archilya-gold px-1 text-[9px] font-bold text-black">
                {activeFilterCount}
              </span>
            )}
          </button>
          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-2 z-[70] w-[min(calc(100vw-4rem),420px)] rounded-xl border border-white/[0.08] bg-[#101010]/98 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
              {/* Tarih Aralığı */}
              <div className="mb-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-2">Tarih Aralığı</p>
                <div className="flex flex-wrap gap-2">
                  {['Son 7 gün', 'Son 30 gün', 'Son 3 ay', 'Tümü'].map((label) => (
                    <button
                      key={label}
                      onClick={() => setFilterDateRange(filterDateRange === label ? null : label)}
                      className={`px-3 py-1.5 rounded-full border text-[10px] transition-all ${
                        filterDateRange === label
                          ? 'border-archilya-gold/30 bg-archilya-gold/[0.08] text-archilya-gold'
                          : 'border-white/[0.06] bg-white/[0.02] text-archilya-text-dim/60 hover:border-white/[0.12] hover:text-archilya-text/80'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Dosya Tipi */}
              <div className="mb-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-2">Dosya Tipi</p>
                <div className="grid grid-cols-4 gap-2">
                  {['DWG', 'SKP', '3DS', 'PDF', 'RVT', 'DOC', 'XLS', 'IMG'].map((type) => (
                    <label key={type} className="flex items-center gap-1.5 cursor-pointer group">
                      <div
                        onClick={() => {
                          const next = new Set(filterFileTypes);
                          if (next.has(type)) next.delete(type);
                          else next.add(type);
                          setFilterFileTypes(next);
                        }}
                        className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${
                          filterFileTypes.has(type)
                            ? 'border-archilya-gold/45 bg-archilya-gold/15'
                            : 'border-white/[0.08] bg-white/[0.02] group-hover:border-white/[0.12]'
                        }`}
                      >
                        {filterFileTypes.has(type) && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold/70"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </div>
                      <span className={`text-[10px] transition-colors ${filterFileTypes.has(type) ? 'text-archilya-text/80' : 'text-archilya-text-dim/60'}`}>{type}</span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Boyut */}
              <div className="mb-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-2">Boyut</p>
                <div className="flex flex-wrap gap-2">
                  {['< 10 MB', '10-100 MB', '100 MB - 1 GB', '> 1 GB'].map((label) => (
                    <button
                      key={label}
                      onClick={() => setFilterSize(filterSize === label ? null : label)}
                      className={`px-3 py-1.5 rounded-full border text-[10px] transition-all ${
                        filterSize === label
                          ? 'border-archilya-gold/30 bg-archilya-gold/[0.08] text-archilya-gold'
                          : 'border-white/[0.06] bg-white/[0.02] text-archilya-text-dim/60 hover:border-white/[0.12] hover:text-archilya-text/80'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Durum */}
              <div className="mb-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-2">Durum</p>
                <div className="flex flex-wrap gap-2">
                  {['Aktif', 'Taslak', 'İncelemede', 'Tamamlandı'].map((label) => (
                    <button
                      key={label}
                      onClick={() => {
                        const next = new Set(filterStatuses);
                        if (next.has(label)) next.delete(label);
                        else next.add(label);
                        setFilterStatuses(next);
                      }}
                      className={`px-3 py-1.5 rounded-full border text-[10px] transition-all ${
                        filterStatuses.has(label)
                          ? 'border-archilya-gold/30 bg-archilya-gold/[0.08] text-archilya-gold'
                          : 'border-white/[0.06] bg-white/[0.02] text-archilya-text-dim/60 hover:border-white/[0.12] hover:text-archilya-text/80'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.05]">
                <button
                  onClick={() => {
                    setFilterDateRange(null);
                    setFilterFileTypes(new Set());
                    setFilterSize(null);
                    setFilterStatuses(new Set());
                    setActiveFilterCount(0);
                  }}
                  className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-[10px] font-display tracking-widest text-archilya-text-dim hover:border-white/[0.14] hover:text-archilya-text transition-colors"
                >
                  Sıfırla
                </button>
                <button
                  onClick={() => {
                    let count = 0;
                    if (filterDateRange) count++;
                    count += filterFileTypes.size;
                    if (filterSize) count++;
                    count += filterStatuses.size;
                    setActiveFilterCount(count);
                    setIsFilterOpen(false);
                  }}
                  className="h-8 rounded-lg border border-archilya-gold/25 bg-archilya-gold/[0.12] px-3 text-[10px] font-display tracking-widest text-archilya-gold hover:bg-archilya-gold hover:text-black transition-colors"
                >
                  Filtreleri Uygula
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/[0.05]">
        {TAB_CONFIG.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.id === 'all'
            ? projectsWithFavorites.length
            : tab.id === 'starred'
              ? projectsWithFavorites.filter((p) => p.isFavorite).length
              : Math.min(5, projectsWithFavorites.length);

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-4 py-2.5 text-[11px] font-medium tracking-wide transition-colors ${
                isActive
                  ? 'text-archilya-gold'
                  : 'text-archilya-text-dim/50 hover:text-archilya-text/70'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`ml-1.5 text-[9px] font-mono ${isActive ? 'text-archilya-gold/60' : 'text-archilya-text-dim/30'}`}>
                {count}
              </span>
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-archilya-gold/60 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-text-dim/20 mb-4">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          <p className="text-[14px] text-archilya-text-dim/70 tracking-wide mb-1">
            {searchQuery ? 'Arama sonucu bulunamadı.' : 'Henüz proje bulunmuyor'}
          </p>
          {!searchQuery && (
            <p className="text-[12px] text-archilya-text-dim/50 mb-6">İlk projenizi oluşturarak başlayın</p>
          )}
          {!searchQuery && (
            <button className="flex items-center gap-2 text-[11px] font-display tracking-widest text-archilya-gold border border-archilya-gold/25 bg-archilya-gold/[0.08] hover:bg-archilya-gold hover:text-black px-4 py-2 rounded-lg transition-all duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              YENİ PROJE
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectGridCard
              key={project.id}
              project={project}
              onClick={() => onProjectSelect(project.id, project.name)}
              onFavoriteToggle={handleFavoriteToggle}
            />
          ))}
        </div>
      ) : (
        <ProjectListTable
          projects={filteredProjects}
          onProjectSelect={onProjectSelect}
          onFavoriteToggle={handleFavoriteToggle}
        />
      )}
    </div>
  );
};
