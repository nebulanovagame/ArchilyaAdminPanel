import React, { useState, useEffect } from 'react';
import type { UserData } from '../../shared/types';
import { ProjectGridCard } from '../components/ProjectGridCard';
import type { ProjectCenterProject } from '../projects/projectCenterTypes';
import { MOCK_FILE_ITEMS } from '../projects/projectFileManagerMockData';

const RECENT_PROJECTS: ProjectCenterProject[] = [
  {
    id: '1',
    name: 'Villa Proje Alpha',
    coverGradient: 'from-emerald-900/60 to-archilya-dark',
    status: 'Aktif',
    projectType: 'UE5',
    fileCount: 24,
    sizeLabel: '1.2 GB',
    lastSync: '2 dk önce',
    lastOpenedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    isFavorite: true,
  },
  {
    id: '2',
    name: 'Ofis Kompleksi Beta',
    coverGradient: 'from-blue-900/60 to-archilya-dark',
    status: 'Taslak',
    projectType: 'CAD',
    fileCount: 8,
    sizeLabel: '450 MB',
    lastSync: 'Dün',
    lastOpenedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
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
    lastOpenedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    isFavorite: false,
  },
  {
    id: '4',
    name: 'Avm Tasarimi Delta',
    coverGradient: 'from-rose-900/60 to-archilya-dark',
    status: 'Tamamlandı',
    projectType: 'UE5',
    fileCount: 32,
    sizeLabel: '2.4 GB',
    lastSync: '1 hafta önce',
    lastOpenedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    isFavorite: false,
  },
];

const STATS = [
  { label: 'AKTİF PROJE', value: '6', sub: '2 si teslimatta' },
  { label: 'ACİL GÖREV', value: '3', sub: 'Bu hafta bitmeli' },
  { label: 'ONAY BEKLEYEN', value: '4', sub: '2 gündür bekliyor' },
];

interface HomeViewProps {
  user: UserData;
  onLogout: () => void;
  onOpenNews?: () => void;
  workMode?: 'solo' | 'office';
}

const LAST_10_FILES = MOCK_FILE_ITEMS
  .filter((item) => item.type === 'file')
  .slice(0, 10)
  .map((item, index) => ({
    ...item,
    openedAt: new Date(Date.now() - 1000 * 60 * 30 * (index + 1)).toISOString(),
    projectName: ['Villa Proje Alpha', 'Ofis Kompleksi Beta', 'Konut Sitesi Gama'][index % 3],
  }));

const HomeViewSkeleton: React.FC<{ workMode?: 'solo' | 'office' }> = ({ workMode = 'office' }) => {
  if (workMode === 'solo') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
        <div className="mb-8">
          <div className="h-8 w-64 rounded skeleton-shimmer mb-2" />
          <div className="h-4 w-48 rounded skeleton-shimmer" />
        </div>
        <div className="mb-10 rounded-2xl border-2 border-dashed border-white/[0.04] flex flex-col items-center justify-center py-14">
          <div className="w-8 h-8 rounded-full skeleton-shimmer mb-4" />
          <div className="h-4 w-48 rounded skeleton-shimmer mb-1" />
          <div className="h-3 w-32 rounded skeleton-shimmer" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-5">
            <div className="h-6 w-32 rounded skeleton-shimmer" />
            <div className="h-3 w-16 rounded skeleton-shimmer" />
          </div>
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                <div className="h-3 w-4 rounded skeleton-shimmer" />
                <div className="h-4 w-4 rounded skeleton-shimmer" />
                <div className="flex-1 min-w-0">
                  <div className="h-3 w-3/4 rounded skeleton-shimmer mb-1" />
                  <div className="h-2 w-1/3 rounded skeleton-shimmer" />
                </div>
                <div className="h-3 w-12 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
      <div className="mb-10">
        <div className="h-8 w-48 rounded skeleton-shimmer mb-2" />
        <div className="h-4 w-64 rounded skeleton-shimmer" />
      </div>
      <div className="flex items-center gap-3 mb-10">
        <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
        <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
        <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
      </div>
      <div className="grid grid-cols-3 gap-4 mb-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
            <div className="h-2 w-16 rounded skeleton-shimmer mb-3" />
            <div className="h-6 w-12 rounded skeleton-shimmer mb-1" />
            <div className="h-2 w-20 rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
      <div className="w-full rounded-2xl border border-white/[0.06] p-5 mb-10">
        <div className="h-2 w-24 rounded skeleton-shimmer mb-2" />
        <div className="h-5 w-64 rounded skeleton-shimmer mb-3" />
        <div className="space-y-1">
          <div className="h-3 w-3/4 rounded skeleton-shimmer" />
          <div className="h-3 w-2/3 rounded skeleton-shimmer" />
          <div className="h-3 w-1/2 rounded skeleton-shimmer" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-10">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full skeleton-shimmer mb-3" />
              <div className="h-3 w-20 rounded skeleton-shimmer mb-1" />
              <div className="h-2 w-32 rounded skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div className="h-6 w-32 rounded skeleton-shimmer" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] h-48 skeleton-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
};

export const HomeView: React.FC<HomeViewProps> = ({ user, onOpenNews, workMode = 'office' }) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <HomeViewSkeleton workMode={workMode} />;
  }

  if (workMode === 'solo') {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
        {/* Solo Header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl tracking-[0.15em] text-archilya-text/90 uppercase">
            Merhaba, {user.displayName?.split(' ')[0] || 'Mimar'}
          </h1>
          <p className="mt-2 text-[12px] text-archilya-text-dim/65 tracking-wide">
            Bugun ne uzerinde calisalim?
          </p>
        </div>

        {/* Drag-Drop Upload Area */}
        <div className="mb-10 rounded-2xl border-2 border-dashed border-archilya-gold/15 bg-white/[0.02] hover:border-archilya-gold/30 hover:bg-white/[0.03] transition-all duration-300 flex flex-col items-center justify-center py-14 cursor-pointer group">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold/40 mb-4 group-hover:text-archilya-gold/60 transition-colors">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p className="text-[13px] text-archilya-text-dim/70 tracking-wide mb-1">Dosyalari buraya surukleyin</p>
          <p className="text-[11px] text-archilya-text-dim/40 tracking-wide">veya yeni bir proje olusturun</p>
        </div>

        {/* Son Calisilan Dosyalar */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-archilya-gold/60 mb-1">Son Calisilan</p>
              <h2 className="font-display text-base tracking-[0.15em] text-archilya-text uppercase">Dosyalar</h2>
            </div>
            <span className="text-[10px] font-mono text-archilya-text-dim/40">{LAST_10_FILES.length} dosya</span>
          </div>

          <div className="space-y-1">
            {LAST_10_FILES.map((file, index) => (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 hover:bg-white/[0.025] hover:border-white/[0.04] transition-all cursor-pointer group"
              >
                <span className="text-[10px] font-mono text-archilya-text-dim/30 w-4 text-right">{index + 1}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-text-dim/40 flex-shrink-0">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-archilya-text-dim/80 truncate">{file.name}</p>
                  <p className="text-[10px] text-archilya-text-dim/40">{file.projectName} · {file.size}</p>
                </div>
                <span className="text-[10px] font-mono text-archilya-text-dim/30 flex-shrink-0">
                  {Math.floor((index + 1) * 0.5)}s once
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
      {/* Hoşgeldin */}
      <div className="mb-10">
        <h1 className="font-display text-2xl tracking-[0.15em] text-archilya-text/90 uppercase">
          Hoş Geldiniz
        </h1>
        <p className="mt-2 text-[12px] text-archilya-text-dim/65 tracking-wide">
          {user.displayName || user.email}
        </p>
      </div>

      {/* Hızlı Eylemler */}
      <div className="flex items-center gap-3 mb-10">
        <button className="flex items-center gap-2 text-[11px] font-display tracking-widest text-archilya-text-dim/60 hover:text-archilya-gold border border-white/[0.04] hover:border-archilya-gold/20 px-3 py-2 rounded-lg transition-all duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
          YENI PROJE
        </button>
        <button className="flex items-center gap-2 text-[11px] font-display tracking-widest text-archilya-text-dim/60 hover:text-archilya-gold border border-white/[0.04] hover:border-archilya-gold/20 px-3 py-2 rounded-lg transition-all duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          AI RENDER
        </button>
        <button className="flex items-center gap-2 text-[11px] font-display tracking-widest text-archilya-text-dim/60 hover:text-archilya-gold border border-white/[0.04] hover:border-archilya-gold/20 px-3 py-2 rounded-lg transition-all duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          TESLİMAT TAKİBİ
        </button>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-xl p-5 bg-white/[0.03] border border-white/[0.06]">
            <p className="text-[10px] font-mono tracking-[0.3em] text-archilya-gold/60 mb-3">{stat.label}</p>
            <p className="font-display text-xl text-archilya-text/80 tracking-wider">{stat.value}</p>
            <p className="text-[9px] text-archilya-text-dim/50 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Komuta Merkezi Widget */}
      {onOpenNews && (
        <button
          type="button"
          onClick={onOpenNews}
          className="w-full text-left rounded-2xl border border-archilya-gold/15 bg-white/[0.03] hover:border-archilya-gold/30 hover:bg-white/[0.04] transition-all p-5 mb-10 group"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-archilya-gold/60 mb-2">Komuta Merkezi</p>
              <h3 className="font-display text-base tracking-[0.15em] text-archilya-text uppercase mb-3">
                Ofis Radarı ve Teslimat Takibi
              </h3>
              <div className="space-y-1">
                <p className="text-[11px] text-archilya-text-dim/65">2 acil teslimat yaklaşıyor — Villa Alpha ve AVM Delta</p>
                <p className="text-[11px] text-archilya-text-dim/65">4 onay beklemede — statik ve elektrik ekiplerinden</p>
                <p className="text-[11px] text-archilya-text-dim/65">Son aktivite: Zeynep, zemin kat planını güncelledi (5 dk önce)</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-archilya-text-dim/40 group-hover:text-archilya-gold transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </div>
          </div>
        </button>
      )}

      {/* Hızlı Başlangıç */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        <div
          className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-archilya-gold/20 transition-all cursor-pointer"
          onClick={() => console.log('quick-start:new-project')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center mb-3 border border-white/[0.06]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </div>
            <h3 className="text-[12px] font-display tracking-wider text-archilya-text uppercase mb-1">Yeni Proje</h3>
            <p className="text-[10px] font-mono text-archilya-text-dim/50 tracking-wide">Yeni bir mimari proje başlatın</p>
          </div>
        </div>

        <div
          className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 hover:border-archilya-gold/20 transition-all cursor-pointer"
          onClick={() => console.log('quick-start:recent-files')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center mb-3 border border-white/[0.06]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h3 className="text-[12px] font-display tracking-wider text-archilya-text uppercase mb-1">Son Dosyalar</h3>
            <p className="text-[10px] font-mono text-archilya-text-dim/50 tracking-wide">Son çalıştığınız dosyalara hızlı erişim</p>
          </div>
        </div>

        <div
          className="bg-white/[0.03] border border-archilya-gold/15 rounded-xl p-5 hover:border-archilya-gold/20 transition-all cursor-pointer"
          onClick={() => console.log('quick-start:pending-approvals')}
        >
          <div className="flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center mb-3 border border-white/[0.06] relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-archilya-gold text-[8px] font-mono font-bold text-archilya-dark flex items-center justify-center">3</span>
            </div>
            <h3 className="text-[12px] font-display tracking-wider text-archilya-text uppercase mb-1">Bekleyen Onaylar</h3>
            <p className="text-[10px] font-mono text-archilya-text-dim/50 tracking-wide">Ekip ve müşteri onayları bekleniyor</p>
          </div>
        </div>
      </div>

      {/* Son Kullanılan Projeler */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-archilya-gold/60 mb-1">Son Kullanılan</p>
            <h2 className="font-display text-base tracking-[0.15em] text-archilya-text uppercase">Projeler</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {RECENT_PROJECTS.map((project) => (
            <ProjectGridCard
              key={project.id}
              project={project}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
