import type { JSX } from 'react';
import { getFileTypeFromName, FILE_TYPE_CONFIG } from '../projects/projectFileTypeConfig';
import type { ArchFileExtension } from '../projects/projectFileTypeConfig';

interface ProjectFileTypeBadgeProps {
  filename: string;
}

const ICONS: Record<ArchFileExtension, JSX.Element> = {
  DWG: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  SKP: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3L21 8.5V15.5L12 21L3 15.5V8.5Z" />
      <path d="M12 3v18M3 8.5l9 5.25m0 0L21 8.5" />
    </svg>
  ),
  '3DS': (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l9 16H3Z" />
    </svg>
  ),
  PDF: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  RVT: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="10" width="14" height="12" />
      <rect x="9" y="6" width="6" height="4" />
      <rect x="9" y="14" width="6" height="4" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  ),
  IFC: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="18" r="3" />
      <circle cx="19" cy="18" r="3" />
      <line x1="12" y1="8" x2="5" y2="15" />
      <line x1="12" y1="8" x2="19" y2="15" />
      <line x1="5" y1="18" x2="19" y2="18" />
    </svg>
  ),
  DOC: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="6" y1="5" x2="18" y2="5" />
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="13" x2="14" y2="13" />
    </svg>
  ),
  XLS: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  IMG: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  OTHER: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};

export function ProjectFileTypeBadge({ filename }: ProjectFileTypeBadgeProps) {
  const ext = getFileTypeFromName(filename);
  const cfg = FILE_TYPE_CONFIG[ext];
  const icon = ICONS[ext];

  return (
    <span
      className={`inline-flex h-6 min-w-12 items-center justify-center gap-1 rounded border px-2 text-[9px] font-mono tracking-[0.18em] ${cfg.border} ${cfg.bg} ${cfg.text}`}
    >
      {icon} {cfg.label}
    </span>
  );
}
