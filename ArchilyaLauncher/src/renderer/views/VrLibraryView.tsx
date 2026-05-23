import React, { useCallback, useEffect, useState } from 'react';
import type { VrProject, VrProjectStatus } from '../../shared/types';

type VrProjectSource = 'RVT' | 'SKP' | 'Native';
type VrLibraryProjectStatus = 'installed' | 'not-installed' | 'downloading';

interface VrLibraryProjectItem {
  id: string;
  name: string;
  size: string;
  status: VrLibraryProjectStatus;
  progress?: number;
  lastUpdated: string;
  engine: string;
  source: VrProjectSource;
}

const SOURCE_BADGE_CONFIG: Record<VrProjectSource, { label: string; color: string; border: string; bg: string }> = {
  RVT: { label: 'Revit (RVT)', color: 'text-indigo-300', border: 'border-indigo-400/20', bg: 'bg-indigo-500/[0.06]' },
  SKP: { label: 'SketchUp (SKP)', color: 'text-red-300', border: 'border-red-400/20', bg: 'bg-red-500/[0.06]' },
  Native: { label: 'Doğal UE5', color: 'text-archilya-text-dim/70', border: 'border-white/[0.08]', bg: 'bg-white/[0.03]' },
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function inferSource(project: VrProject): VrProjectSource {
  const haystack = [
    project.category || '',
    ...project.files.map((file) => file.name || ''),
    ...project.files.map((file) => file.url || ''),
  ].join(' ').toLowerCase();

  if (haystack.includes('.rvt') || haystack.includes('revit') || haystack.includes('rvt')) {
    return 'RVT';
  }

  if (haystack.includes('.skp') || haystack.includes('sketchup') || haystack.includes('skp')) {
    return 'SKP';
  }

  return 'Native';
}

function mapProjectStatus(status: VrProjectStatus): VrLibraryProjectStatus {
  switch (status) {
    case 'INSTALLED':
      return 'installed';
    case 'DOWNLOADING':
      return 'downloading';
    case 'NOT_INSTALLED':
    default:
      return 'not-installed';
  }
}

function toProjectItem(project: VrProject, status: VrProjectStatus): VrLibraryProjectItem {
  const totalSize = project.files.reduce((sum, file) => sum + (file.size || 0), 0);

  return {
    id: project.id,
    name: project.title,
    size: formatBytes(totalSize),
    status: mapProjectStatus(status),
    progress: status === 'DOWNLOADING' ? 0 : undefined,
    lastUpdated: project.vrMapName || project.map_name || 'Atandı',
    engine: 'UE5',
    source: inferSource(project),
  };
}

export const VrLibraryView: React.FC = () => {
  const [projects, setProjects] = useState<VrLibraryProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const fetchedProjects = await window.api.getProjects();
      const statusResults = await Promise.allSettled(
        fetchedProjects.map(async (project) => {
          if (project.isBuiltInDemo || project.isEmbedded) {
            return { projectId: project.id, status: 'INSTALLED' as VrProjectStatus };
          }

          const status = await window.api.checkProjectStatus(project);
          return { projectId: project.id, status };
        }),
      );

      const statusMap = new Map<string, VrProjectStatus>();
      statusResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          statusMap.set(result.value.projectId, result.value.status);
          return;
        }

        statusMap.set(fetchedProjects[index].id, 'NOT_INSTALLED');
      });

      setProjects(
        fetchedProjects.map((project) => toProjectItem(project, statusMap.get(project.id) || 'NOT_INSTALLED')),
      );
    } catch (fetchError) {
      console.error('VR projects load error:', fetchError);
      setProjects([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    const cleanup = window.api.onProjectProgress((data) => {
      setProjects((currentProjects) => currentProjects.map((project) => (
        project.id === data.projectId
          ? { ...project, status: 'downloading', progress: data.progress }
          : project
      )));
    });

    return cleanup;
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase">VR Kütüphanesi</h1>
        <p className="mt-1 text-[11px] uppercase tracking-[0.35em] text-archilya-text-dim/60">
          Sunucu tarafından atanmış VR projeleri
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl p-8 bg-white/[0.03] border border-white/[0.06]">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-8 h-8 border-2 border-white/[0.08] border-t-archilya-gold/70 rounded-full animate-spin" />
            <p className="text-[11px] font-mono tracking-[0.25em] uppercase text-archilya-text-dim/60">
              VR projeleri yükleniyor
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center rounded-xl p-8 bg-white/[0.03] border border-white/[0.06]">
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <div className="w-12 h-12 rounded-full border border-red-400/15 bg-red-500/[0.05] flex items-center justify-center text-red-300/70">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="text-sm text-archilya-text-dim/80">
              VR projeleri yüklenirken bir hata oluştu.
            </p>
            <button
              onClick={() => void loadProjects()}
              className="flex items-center gap-2 h-8 px-4 rounded-lg bg-archilya-gold/[0.05] border border-archilya-gold/15 hover:bg-archilya-gold/[0.12] hover:border-archilya-gold/30 text-archilya-gold/70 hover:text-archilya-gold transition-all duration-300"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" /><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" /></svg>
              <span className="text-[11px] font-display tracking-[0.15em] font-semibold uppercase">Tekrar Dene</span>
            </button>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl p-8 bg-white/[0.03] border border-white/[0.06]">
          <div className="flex flex-col items-center gap-4 text-center max-w-md">
            <div className="w-12 h-12 rounded-full border border-white/[0.08] bg-white/[0.03] flex items-center justify-center text-archilya-text-dim/45">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z" />
              </svg>
            </div>
            <p className="text-sm text-archilya-text-dim/80">
              Henüz atanmış bir VR projeniz bulunmuyor.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex items-center gap-5 rounded-xl p-5 bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.08] transition-all duration-300"
            >
              {/* Icon / Thumbnail placeholder */}
              <div className="w-12 h-12 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-text-dim/45">
                  <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/>
                </svg>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <h3 className="font-display text-[13px] tracking-[0.15em] text-archilya-text uppercase truncate">
                    {project.name}
                  </h3>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase border border-white/[0.06] bg-white/[0.03] text-archilya-text-dim/60">
                    {project.engine}
                  </span>
                  {(() => {
                    const src = SOURCE_BADGE_CONFIG[project.source];
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono tracking-widest uppercase border ${src.border} ${src.bg} ${src.color}`}>
                        {src.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-archilya-text-dim/50 tracking-wider">
                  <span>{project.size}</span>
                  <span>·</span>
                  <span>{project.lastUpdated}</span>
                </div>
              </div>

              {/* Status + Action */}
              <div className="flex items-center gap-4 flex-shrink-0">
                {project.status === 'installed' && (
                  <>
                    <span className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-emerald-400/70">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Yüklü
                    </span>
                    <button
                      onClick={() => alert(`Pixel Streaming bağlantısı kopyalandı: https://stream.archilya.app/vr/${project.id} (Demo)`)}
                      className="flex items-center gap-2 h-8 px-3 rounded-lg bg-archilya-gold/[0.05] border border-archilya-gold/15 hover:bg-archilya-gold/[0.12] hover:border-archilya-gold/30 text-archilya-gold/70 hover:text-archilya-gold transition-all duration-300"
                      title="Pixel Streaming ile Müşteriye Paylaş"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      <span className="text-[11px] font-display tracking-[0.15em] font-semibold uppercase">Stream</span>
                    </button>
                    <button className="flex items-center gap-2 h-8 px-4 rounded-lg bg-emerald-500/[0.05] border border-emerald-400/15 hover:bg-emerald-500/[0.12] hover:border-emerald-400/30 text-emerald-300 hover:text-emerald-300 transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <span className="text-[11px] font-display tracking-[0.15em] font-semibold uppercase">Başlat</span>
                    </button>
                  </>
                )}

                {project.status === 'not-installed' && (
                  <>
                    <span className="text-[10px] font-mono tracking-wider text-archilya-text-dim/45">
                      Yüklü Değil
                    </span>
                    <button className="flex items-center gap-2 h-8 px-4 rounded-lg bg-archilya-gold/[0.05] border border-archilya-gold/15 hover:bg-archilya-gold/[0.12] hover:border-archilya-gold/30 text-archilya-gold/60 hover:text-archilya-gold transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      <span className="text-[11px] font-display tracking-[0.15em] font-semibold uppercase">İndir</span>
                    </button>
                  </>
                )}

                {project.status === 'downloading' && (
                  <>
                    <div className="w-32">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono tracking-wider text-archilya-gold/70">İndiriliyor</span>
                        <span className="text-[10px] font-mono text-archilya-text-dim/50">%{project.progress ?? 0}</span>
                      </div>
                      <div className="w-full h-[2px] bg-white/[0.03] rounded-full overflow-hidden">
                        <div className="h-full bg-archilya-gold/40 rounded-full transition-all" style={{ width: `${project.progress ?? 0}%` }} />
                      </div>
                    </div>
                    <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-red-400/10 hover:border-red-400/25 text-red-400 hover:text-red-300 transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      <span className="text-[11px] font-display tracking-wider">İptal</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
