import React from 'react';
import type { ProjectCenterProject } from '../projects/projectCenterTypes';
import { COLOR_LABEL_CONFIG } from '../projects/projectCenterData';

const STATUS_CONFIG: Record<ProjectCenterProject['status'], { label: string; dot: string; text: string }> = {
  'Aktif':       { label: 'AKTİF',       dot: 'bg-emerald-400/70',    text: 'text-emerald-400/80' },
  'Taslak':      { label: 'TASLAK',      dot: 'bg-archilya-gold/40',  text: 'text-archilya-gold/70' },
  'İncelemede':  { label: 'İNCELEMEDE',  dot: 'bg-blue-400/50',       text: 'text-blue-400/70' },
  'Tamamlandı':  { label: 'TAMAMLANDI',  dot: 'bg-archilya-text-dim/30', text: 'text-archilya-text-dim/60' },
};

const TYPE_CONFIG: Record<ProjectCenterProject['projectType'], { label: string }> = {
  'UE5':    { label: 'UE5' },
  'CAD':    { label: 'CAD' },
  '3D':     { label: '3D' },
  'Other':  { label: 'PROJE' },
};

interface ProjectListTableProps {
  projects: ProjectCenterProject[];
  onProjectSelect: (projectId: string, projectName: string) => void;
  onFavoriteToggle: (id: string) => void;
}

export const ProjectListTable: React.FC<ProjectListTableProps> = ({
  projects,
  onProjectSelect,
  onFavoriteToggle,
}) => {
  return (
    <div className="flex-1 overflow-auto custom-scrollbar min-w-0">
      <div className="min-w-[720px]">
        {/* Table Header */}
        <div className="px-6 py-3 grid grid-cols-[48px_1fr_80px_120px_100px_140px_60px] gap-4 items-center text-[10px] font-mono tracking-wider text-archilya-text-dim/45 uppercase border-b border-white/[0.05]">
          <span></span>
          <span>Proje Adı</span>
          <span>Tip</span>
          <span>Durum</span>
          <span>Dosya</span>
          <span>Son Senkronizasyon</span>
          <span></span>
        </div>

        {/* Rows */}
        {projects.map((project) => {
          const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG['Taslak'];
          const typeCfg = TYPE_CONFIG[project.projectType] ?? TYPE_CONFIG['Other'];
          const colorCfg = project.colorLabel ? COLOR_LABEL_CONFIG[project.colorLabel] : null;

          return (
            <div
              key={project.id}
              onClick={() => onProjectSelect(project.id, project.name)}
              className="mx-6 my-1 grid grid-cols-[48px_1fr_80px_120px_100px_140px_60px] gap-4 items-center px-3 py-3 rounded-lg hover:bg-white/[0.03] transition-colors cursor-pointer group"
            >
            {/* Mini Cover */}
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${project.coverGradient} flex-shrink-0`} />

            {/* Name + Type badge inline */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-archilya-text font-medium truncate">{project.name}</span>
                {project.isFavorite && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold flex-shrink-0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                )}
              </div>
            </div>

            {/* Type */}
            <span className="text-[10px] font-mono text-archilya-text-dim/65 tracking-wider">
              {typeCfg.label}
            </span>

            {/* Status + Color Label */}
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              <span className={`text-[10px] font-mono tracking-wider uppercase ${statusCfg.text}`}>
                {statusCfg.label}
              </span>
              {colorCfg && (
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono tracking-wider uppercase border ${colorCfg.border} ${colorCfg.bg} ${colorCfg.text}`}>
                  {project.colorLabel}
                </span>
              )}
            </div>

            {/* File Count */}
            <span className="text-[10px] font-mono text-archilya-text-dim/50">
              {project.fileCount} dosya
            </span>

            {/* Last Sync */}
            <span className="text-[10px] font-mono text-archilya-text-dim/40">
              {project.lastSync}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onFavoriteToggle(project.id); }}
                className={`w-7 h-7 flex items-center justify-center rounded hover:bg-white/[0.05] transition-colors ${project.isFavorite ? 'text-archilya-gold' : 'text-archilya-text-dim/40 hover:text-archilya-gold'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={project.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onProjectSelect(project.id, project.name); }}
                className="w-7 h-7 flex items-center justify-center rounded text-archilya-text-dim/40 hover:text-archilya-text hover:bg-white/[0.05] transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
              </button>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};
