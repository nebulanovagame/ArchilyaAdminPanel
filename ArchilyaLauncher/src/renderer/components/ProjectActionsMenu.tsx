import React, { useState, useRef, useEffect } from 'react';
import type { ProjectCenterProject } from '../projects/projectCenterTypes';

interface ProjectActionsMenuProps {
  project: ProjectCenterProject;
  onOpenFolder?: () => void;
  onFavoriteToggle?: (id: string) => void;
}

export const ProjectActionsMenu: React.FC<ProjectActionsMenuProps> = ({
  project,
  onOpenFolder,
  onFavoriteToggle,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm text-white/75 hover:text-white transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-[#121212] border border-white/[0.06] rounded-lg overflow-hidden shadow-2xl z-50">
          <button
            onClick={(e) => { e.stopPropagation(); onOpenFolder?.(); setMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-archilya-text-dim/85 hover:text-archilya-text hover:bg-white/[0.03] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
            Klasörü Aç
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(project.id); setMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-[12px] text-archilya-text-dim/85 hover:text-archilya-gold hover:bg-white/[0.03] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={project.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            {project.isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
          </button>

          <div className="px-4 py-2 flex items-center gap-2 text-[11px] text-archilya-text-dim/55 border-t border-white/[0.03]">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/50"><polyline points="20 6 9 17 4 12"/></svg>
            Senkronize · {project.fileCount} dosya · {project.sizeLabel}
          </div>
          <div className="px-4 py-1.5 text-[10px] text-archilya-text-dim/45">
            Son senk: {project.lastSync}
          </div>
        </div>
      )}
    </div>
  );
};
