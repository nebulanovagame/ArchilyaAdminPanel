import React, { useEffect, useRef } from 'react';
import type { FileTableItem } from './ProjectFileTable';
import type { FileVersion } from '../projects/projectFileVersionsMockData';
import { getFileTypeFromName } from '../projects/projectFileTypeConfig';
import type { ArchFileExtension } from '../projects/projectFileTypeConfig';

interface FilePreviewModalProps {
  item: FileTableItem | null;
  isOpen: boolean;
  onClose: () => void;
  versions?: FileVersion[];
  onRestoreVersion?: (versionId: string) => void;
}

const HEADER_ICONS: Record<ArchFileExtension, React.ReactNode> = {
  DWG: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  SKP: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <path d="M12 3L21 8.5V15.5L12 21L3 15.5V8.5Z" />
      <path d="M12 3v18M3 8.5l9 5.25m0 0L21 8.5" />
    </svg>
  ),
  '3DS': (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <path d="M12 3l9 16H3Z" />
    </svg>
  ),
  PDF: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
RVT: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <rect x="5" y="10" width="14" height="12" />
      <rect x="9" y="6" width="6" height="4" />
      <rect x="9" y="14" width="6" height="4" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  ),
  IFC: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="18" r="3" />
      <circle cx="19" cy="18" r="3" />
      <line x1="12" y1="8" x2="5" y2="15" />
      <line x1="12" y1="8" x2="19" y2="15" />
      <line x1="5" y1="18" x2="19" y2="18" />
    </svg>
  ),
  DOC: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <line x1="6" y1="5" x2="18" y2="5" />
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="13" x2="14" y2="13" />
    </svg>
  ),
  XLS: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  IMG: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  OTHER: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-archilya-gold/60">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  item,
  isOpen,
  onClose,
  versions,
  onRestoreVersion,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen || !item) {
    return null;
  }

  const fileType = getFileTypeFromName(item.name);
  const versionCount = versions?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/80 backdrop-blur-md"
      onClick={handleOverlayClick}
    >
      <div
        ref={contentRef}
        className="flex flex-col w-full h-full bg-[#0e0e0e]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="h-14 border-b border-white/[0.06] flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {HEADER_ICONS[fileType]}
            <span className="text-sm text-archilya-text font-medium truncate max-w-[400px]">
              {item.name}
            </span>
            {versionCount > 0 && (
              <span className="text-[10px] font-mono bg-archilya-gold/[0.08] border border-archilya-gold/15 text-archilya-gold/70 px-1.5 py-0.5 rounded flex-shrink-0">
                v{versionCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              className="h-8 px-3 text-[11px] font-mono tracking-wider text-archilya-text-dim/60 hover:text-archilya-text hover:bg-white/[0.03] transition-colors rounded border border-transparent hover:border-white/[0.06]"
            >
              Paylaş
            </button>
            <button
              type="button"
              className="h-8 px-3 text-[11px] font-mono tracking-wider text-archilya-gold/70 hover:text-archilya-gold hover:bg-archilya-gold/[0.06] transition-colors rounded border border-archilya-gold/25 hover:border-archilya-gold/40"
            >
              İndir
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded text-archilya-text-dim/50 hover:text-archilya-text hover:bg-white/[0.03] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Preview Area */}
          <div className="flex-1 flex items-center justify-center bg-black/40 relative">
            <div id="preview-content" className="w-full h-full" />

            {/* Zoom Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <button
                type="button"
                className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-archilya-text-dim/60 hover:text-archilya-text hover:bg-white/[0.10] hover:border-white/[0.15] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <button
                type="button"
                className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-archilya-text-dim/60 hover:text-archilya-text hover:bg-white/[0.10] hover:border-white/[0.15] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Version Sidebar */}
          <div className="w-[280px] border-l border-white/[0.06] bg-white/[0.02] flex flex-col flex-shrink-0">
            <div className="px-4 pt-4 pb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
                Versiyon Geçmişi
              </span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4">
              {versions && versions.length > 0 ? (
                <div className="space-y-0">
                  {versions.map((version, index) => (
                    <div key={version.id} className="relative flex gap-3 py-3 border-b border-white/[0.03] last:border-0">
                      {/* Timeline dot and line */}
                      <div className="relative flex flex-col items-center flex-shrink-0 pt-1">
                        <div className="w-2 h-2 rounded-full bg-archilya-gold/40" />
                        {index < versions.length - 1 && (
                          <div className="w-px flex-1 bg-white/[0.06] mt-1" />
                        )}
                      </div>

                      {/* Version Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-mono text-archilya-text-dim/50 truncate">
                            {version.versionCode}
                          </span>
                          <span className="text-[9px] font-mono text-archilya-gold/55 flex-shrink-0">
                            {version.size}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-archilya-text-dim/40">
                            {version.author} · {new Date(version.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onRestoreVersion?.(version.id)}
                            className="h-6 rounded border border-archilya-gold/20 bg-archilya-gold/[0.06] px-2 text-[9px] font-mono text-archilya-gold/70 hover:border-archilya-gold/35 hover:bg-archilya-gold/[0.12] hover:text-archilya-gold transition-colors"
                          >
                            Geri Yükle
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-archilya-text-dim/40 text-center py-8">
                  Henüz versiyon kaydı yok.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
