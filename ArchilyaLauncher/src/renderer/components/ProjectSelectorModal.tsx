import React, { useState, useEffect } from 'react';
import type { FirebaseProject } from '../../shared/types';

interface ProjectSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (projectId: string, projectName: string) => void;
}

export const ProjectSelectorModal: React.FC<ProjectSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [projects, setProjects] = useState<FirebaseProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    let unsubChanged: (() => void) | null = null;
    let unsubError: (() => void) | null = null;

    const setup = async () => {
      try {
        const user = await window.api.checkSession();
        if (!user) {
          setLoading(false);
          return;
        }
        await window.api.subscribeProjects(user.uid);
        unsubChanged = window.api.onProjectsChanged((data) => {
          setProjects(data.filter((p) => !p.isDeleted));
          setLoading(false);
        });
        unsubError = window.api.onProjectsError(() => {
          setLoading(false);
        });
      } catch {
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (unsubChanged) unsubChanged();
      if (unsubError) unsubError();
      window.api.unsubscribeProjects().catch(() => {});
    };
  }, [isOpen]);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConfirm = () => {
    if (!selectedId) return;
    const project = projects.find((p) => p.id === selectedId);
    if (!project) return;
    onSelect(project.id, project.name);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#0f1115] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.04]">
          <h2 className="text-sm font-display text-archilya-text">Projeye Kaydet</h2>
          <p className="text-[10px] text-archilya-text-dim/40 mt-0.5">Sonucunuzu kaydetmek istediğiniz projeyi seçin</p>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-white/[0.04]">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-archilya-text-dim/30"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Proje ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/20 focus:outline-none focus:border-archilya-gold/30 transition-colors"
            />
          </div>
        </div>

        {/* Project List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-archilya-panel border-t-archilya-gold rounded-full animate-spin" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-archilya-text-dim/20 gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
              <p className="text-[11px]">Proje bulunamadı</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredProjects.map((project) => {
                const isSelected = selectedId === project.id;
                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedId(project.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      isSelected
                        ? 'bg-archilya-gold/[0.06] border border-archilya-gold/20'
                        : 'hover:bg-white/[0.02] border border-transparent'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-archilya-gold/10' : 'bg-white/[0.03]'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={isSelected ? 'text-archilya-gold' : 'text-archilya-text-dim/30'}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-medium truncate ${isSelected ? 'text-archilya-gold' : 'text-archilya-text'}`}>{project.name}</p>
                      <p className="text-[9px] text-archilya-text-dim/30 truncate">{project.status} · {project.files?.length ?? 0} dosya</p>
                    </div>
                    {isSelected && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold"><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.04]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded text-[11px] text-archilya-text-dim/50 hover:text-archilya-text hover:bg-white/[0.02] transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="px-4 py-2 rounded bg-archilya-gold/10 border border-archilya-gold/30 text-[11px] text-archilya-gold hover:bg-archilya-gold hover:text-black disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-archilya-gold/10 disabled:hover:text-archilya-gold transition-all"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
};
