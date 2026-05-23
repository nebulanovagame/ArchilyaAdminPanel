import React from 'react';
import type { ProjectCenterProject } from '../projects/projectCenterTypes';
import { COLOR_LABEL_CONFIG } from '../projects/projectCenterData';
import { ProjectActionsMenu } from './ProjectActionsMenu';

export type ProjectStatus = 'Aktif' | 'Taslak' | 'İncelemede' | 'Tamamlandı';
export type ProjectType = 'UE5' | 'CAD' | '3D' | 'Other';

const STATUS_CONFIG: Record<ProjectStatus, { label: string; dot: string; text: string }> = {
  'Aktif':       { label: 'AKTİF',       dot: 'bg-emerald-400/70',    text: 'text-emerald-400/80' },
  'Taslak':      { label: 'TASLAK',      dot: 'bg-archilya-gold/40',  text: 'text-archilya-gold/70' },
  'İncelemede':  { label: 'İNCELEMEDE',  dot: 'bg-blue-400/50',       text: 'text-blue-400/70' },
  'Tamamlandı':  { label: 'TAMAMLANDI',  dot: 'bg-archilya-text-dim/30', text: 'text-archilya-text-dim/60' },
};

const TYPE_CONFIG: Record<ProjectType, { label: string; bg: string; text: string }> = {
  'UE5':    { label: 'UE5',    bg: 'bg-white/[0.04]', text: 'text-archilya-text/70' },
  'CAD':    { label: 'CAD',    bg: 'bg-white/[0.04]', text: 'text-archilya-text/70' },
  '3D':     { label: '3D',     bg: 'bg-white/[0.04]', text: 'text-archilya-text/70' },
  'Other':  { label: 'PROJE',  bg: 'bg-white/[0.04]', text: 'text-archilya-text/70' },
};

interface ProjectGridCardProps {
  project: ProjectCenterProject;
  onClick?: () => void;
  onFavoriteToggle?: (id: string) => void;
}

export const ProjectGridCard: React.FC<ProjectGridCardProps> = ({
  project,
  onClick,
  onFavoriteToggle,
}) => {
  const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG['Taslak'];
  const typeCfg = TYPE_CONFIG[project.projectType] ?? TYPE_CONFIG['Other'];
  const colorCfg = project.colorLabel ? COLOR_LABEL_CONFIG[project.colorLabel] : null;

  return (
    <div
      onClick={onClick}
      className="group relative bg-white/[0.04] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.08] transition-all duration-500 cursor-pointer"
    >
      {/* Kapak Fotoğrafı Alanı */}
      <div className={`relative aspect-[16/9] min-h-36 bg-gradient-to-br ${project.coverGradient} overflow-hidden`}>
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />

        {/* Proje Tipi Badge — sol üst */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase border border-white/[0.06] ${typeCfg.bg} ${typeCfg.text}`}>
            {typeCfg.label}
          </span>
          {colorCfg && (
            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono tracking-wider uppercase border ${colorCfg.border} ${colorCfg.bg} ${colorCfg.text}`}>
              {project.colorLabel}
            </span>
          )}
        </div>

        {/* Yıldız — her zaman görünür, favoriyse tam opak */}
        <div className={`absolute top-4 right-12 transition-opacity duration-300 z-10 ${project.isFavorite ? 'opacity-100' : 'opacity-40'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(project.id); }}
            className={`w-7 h-7 flex items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors ${project.isFavorite ? 'text-archilya-gold' : 'text-white/50 hover:text-archilya-gold'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={project.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </button>
        </div>

        {/* Üç Nokta Menü — sadece hover'da görünür */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
          <ProjectActionsMenu
            project={project}
            onOpenFolder={() => {}}
            onFavoriteToggle={onFavoriteToggle}
          />
        </div>

        {/* Alt overlay: proje adı */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/60 to-transparent">
          <h3 className="font-display text-sm text-white/90 uppercase tracking-[0.2em] truncate">
            {project.name}
          </h3>
        </div>
      </div>

      {/* İçerik */}
      <div className="p-6">
        {/* Durum rozeti + İçerik bilgisi */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className={`w-1 h-1 rounded-full ${statusCfg.dot}`} />
            <span className={`text-[11px] font-mono tracking-[0.25em] uppercase ${statusCfg.text}`}>
              {statusCfg.label}
            </span>
          </div>
          <span className="text-[10px] font-mono text-archilya-text-dim/50 tracking-wider">
            {project.fileCount} dosya
          </span>
        </div>

        {/* Dosyaları Yönet */}
        <button
          onClick={(e) => { e.stopPropagation(); onClick?.(); }}
          className="w-full flex items-center justify-center gap-2.5 h-10 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-archilya-gold/20 text-archilya-text-dim/40 hover:text-archilya-text/70 transition-all duration-300"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          <span className="text-[11px] font-display tracking-[0.2em] font-semibold uppercase">Dosyaları Yönet</span>
        </button>
      </div>
    </div>
  );
};
