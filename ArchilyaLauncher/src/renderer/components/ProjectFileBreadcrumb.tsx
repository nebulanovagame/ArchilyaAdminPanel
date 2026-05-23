import React from 'react';

interface ProjectFileBreadcrumbProps {
  projectName: string;
  currentFolder: string;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
}

export const ProjectFileBreadcrumb: React.FC<ProjectFileBreadcrumbProps> = ({
  projectName,
  currentFolder,
  onNavigateHome,
  onNavigateProject,
}) => {
  return (
    <div className="h-11 px-6 border-b border-white/[0.03] bg-[#0a0a0a]/70 flex items-center gap-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-3 h-3 text-archilya-text-dim/40"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>

      <button
        onClick={onNavigateHome}
        className="text-[10px] font-mono tracking-[0.18em] uppercase text-archilya-text-dim/60 hover:text-archilya-gold cursor-pointer transition-colors bg-transparent border-none p-0"
      >
        Projeler
      </button>

      <span className="text-archilya-text-dim/30 mx-1">/</span>

      <button
        onClick={onNavigateProject}
        className="text-[10px] font-mono tracking-[0.18em] uppercase text-archilya-text-dim/80 hover:text-archilya-text cursor-pointer transition-colors bg-transparent border-none p-0"
      >
        {projectName}
      </button>

      <span className="text-archilya-text-dim/30 mx-1">/</span>

      <span className="text-[10px] font-mono tracking-[0.18em] uppercase text-archilya-gold">
        {currentFolder}
      </span>
    </div>
  );
};