import React, { useEffect, useMemo, useState } from 'react';
import type { FirebaseProject, ProjectFile, UserData } from '../../shared/types';

interface DeletedItem {
  key: string;
  name: string;
  type: 'file' | 'folder';
  originalLocation: string;
  deletedAt: string;
  deletedBy: string;
}

interface TrashViewProps {
  user: UserData;
}

const FileIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold/60">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const FolderIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold/60">
    <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
  </svg>
);

const EmptyStateIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold/30">
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v5" />
    <path d="M14 11v5" />
  </svg>
);

const formatDeletedAt = (updatedAt: FirebaseProject['updatedAt']): string => {
  if (!updatedAt) return 'Bilinmiyor';

  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  return Number.isNaN(date.getTime()) ? 'Bilinmiyor' : date.toLocaleString('tr-TR');
};

const buildOriginalLocation = (project: FirebaseProject, file: ProjectFile): string => {
  if (!file.path) return project.name;

  const normalizedPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
  return normalizedPath ? `${project.name}/${normalizedPath}` : project.name;
};

export const TrashView: React.FC<TrashViewProps> = ({ user }) => {
  const [projects, setProjects] = useState<FirebaseProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user.uid) {
      return;
    }

    void window.api.subscribeProjects(user.uid).catch((error) => {
      console.error('Trash subscription failed:', error);
      setProjects([]);
      setIsLoading(false);
    });

    const cleanupProjects = window.api.onProjectsChanged((newProjects) => {
      setProjects(newProjects);
      setIsLoading(false);
    });

    const cleanupProjectsError = window.api.onProjectsError((error) => {
      console.error('Trash projects error:', error);
      setProjects([]);
      setIsLoading(false);
    });

    return () => {
      cleanupProjects();
      cleanupProjectsError();
      void window.api.unsubscribeProjects();
    };
  }, [user?.uid]);

  const deletedItems = useMemo<DeletedItem[]>(() => {
    return projects.flatMap((project) =>
      (project.deletedFiles ?? []).map((file, index) => ({
        key: `${project.id}-${file.name}-${file.path ?? index}`,
        name: file.name,
        type: 'file',
        originalLocation: buildOriginalLocation(project, file),
        deletedAt: formatDeletedAt(project.updatedAt),
        deletedBy: project.uid || 'Bilinmiyor',
      }))
    );
  }, [projects]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
      <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase mb-8">Çöp Kutusu</h1>

      {/* Çöp Kutusunu Boşalt Button */}
      <div className="mb-6">
        <div className="group/tooltip relative inline-block">
          <button
            disabled
            aria-disabled="true"
            className="cursor-not-allowed opacity-40 px-4 py-2 rounded-md text-[11px] font-medium tracking-wide border bg-red-500/10 border-red-500/30 text-red-400/50 transition-colors"
          >
            Çöp Kutusunu Boşalt
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-md bg-[#1a1a1a] border border-white/[0.08] text-[10px] text-archilya-text-dim/80 whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
            Bu işlem için Yönetici (Admin) yetkisi gereklidir
          </div>
        </div>
      </div>

      {/* Silinen Öğeler Listesi */}
      <div className="space-y-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between px-4 py-2.5 rounded-lg">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-[14px] h-[14px] rounded-sm skeleton-shimmer flex-shrink-0" />
                <div className="flex flex-col min-w-0 flex-1 gap-1.5">
                  <div className="h-3 w-40 rounded skeleton-shimmer" />
                  <div className="h-2.5 w-56 rounded skeleton-shimmer" />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                <div className="h-2.5 w-24 rounded skeleton-shimmer mr-2" />
                <div className="h-6 w-16 rounded skeleton-shimmer" />
                <div className="h-6 w-24 rounded skeleton-shimmer" />
              </div>
            </div>
          ))
        ) : deletedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <EmptyStateIcon />
            <p className="mt-4 text-[12px] tracking-wide text-archilya-text-dim/55">Çöp kutusu boş.</p>
          </div>
        ) : (
          deletedItems.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-white/[0.01] transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {item.type === 'folder' ? <FolderIcon /> : <FileIcon />}
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] text-archilya-text-dim/80 truncate">{item.name}</span>
                  <span className="text-[10px] font-mono text-archilya-text-dim/40 truncate">
                    {item.originalLocation} · {item.deletedBy}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] font-mono text-archilya-text-dim/35 mr-2">{item.deletedAt}</span>

                {/* Geri Yükle Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Bu ogeleri geri yuklemek istediginize emin misiniz?')) return;
                  }}
                  className="px-2.5 py-1 rounded text-[10px] font-medium tracking-wide border bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                >
                  Geri Yükle
                </button>

                {/* Kalıcı Olarak Sil Button (disabled) */}
                <div className="group/tooltip relative inline-block">
                  <button
                    disabled
                    aria-disabled="true"
                    className="cursor-not-allowed opacity-40 px-2.5 py-1 rounded text-[10px] font-medium tracking-wide border bg-red-500/10 border-red-500/30 text-red-400/50 transition-colors"
                  >
                    Kalıcı Olarak Sil
                  </button>
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-md bg-[#1a1a1a] border border-white/[0.08] text-[10px] text-archilya-text-dim/80 whitespace-nowrap opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                    Bu işlem için Yönetici (Admin) yetkisi gereklidir
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
