import type { JSX } from 'react';
import type { FileTableItem } from './ProjectFileTable';
import { ProjectFileTypeBadge } from './ProjectFileTypeBadge';
import { AIMagicRename } from './AIMagicRename';
import { getFileTypeFromName } from '../projects/projectFileTypeConfig';
import type { ArchFileExtension } from '../projects/projectFileTypeConfig';

interface ProjectFileGalleryProps {
  items: FileTableItem[];
  isLoading?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectItem: (id: string) => void;
  onAiRename?: (id: string, newName: string) => void;
  onLock?: (id: string) => void;
  onUnlock?: (id: string) => void;
  workMode?: 'solo' | 'office';
}

const PREVIEW_GRADIENT: Record<ArchFileExtension, string> = {
  DWG: 'bg-gradient-to-br from-blue-900/40 to-blue-950/20',
  SKP: 'bg-gradient-to-br from-red-900/40 to-red-950/20',
  '3DS': 'bg-gradient-to-br from-purple-900/40 to-purple-950/20',
  PDF: 'bg-gradient-to-br from-rose-900/40 to-rose-950/20',
  RVT: 'bg-gradient-to-br from-cyan-900/40 to-cyan-950/20',
  IFC: 'bg-gradient-to-br from-amber-900/40 to-amber-950/20',
  DOC: 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/20',
  XLS: 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/20',
  IMG: 'bg-gradient-to-br from-slate-700/40 via-slate-800/30 to-slate-900/20',
  OTHER: 'bg-gradient-to-br from-white/[0.03] to-white/[0.01]',
};

const GALLERY_ICONS: Record<ArchFileExtension, JSX.Element> = {
  DWG: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  SKP: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <path d="M12 3L21 8.5V15.5L12 21L3 15.5V8.5Z" />
      <path d="M12 3v18M3 8.5l9 5.25m0 0L21 8.5" />
    </svg>
  ),
  '3DS': (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <path d="M12 3l9 16H3Z" />
    </svg>
  ),
  PDF: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
RVT: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <rect x="5" y="10" width="14" height="12" />
      <rect x="9" y="6" width="6" height="4" />
      <rect x="9" y="14" width="6" height="4" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  ),
  IFC: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="18" r="3" />
      <circle cx="19" cy="18" r="3" />
      <line x1="12" y1="8" x2="5" y2="15" />
      <line x1="12" y1="8" x2="19" y2="15" />
      <line x1="5" y1="18" x2="19" y2="18" />
    </svg>
  ),
  DOC: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <line x1="6" y1="5" x2="18" y2="5" />
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="13" x2="14" y2="13" />
    </svg>
  ),
  XLS: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  IMG: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  OTHER: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" opacity="0.2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};

const DWG_GRID_PATTERN = 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)';

const GalleryCheckbox: React.FC<{
  checked: boolean;
  onChange: () => void;
}> = ({ checked, onChange }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className="relative h-3.5 w-3.5 appearance-none rounded-[3px] border border-white/[0.12] bg-white/[0.02] transition-colors focus:outline-none focus:ring-1 focus:ring-archilya-gold/30"
    style={{
      backgroundColor: checked ? 'rgba(212,175,55,0.2)' : undefined,
      borderColor: checked ? 'rgba(212,175,55,0.6)' : undefined,
    }}
  >
    {checked && (
      <svg
        className="absolute inset-0 m-auto"
        width="8"
        height="8"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'rgba(212,175,55,0.8)' }}
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
  </button>
);

export const ProjectFileGallery: React.FC<ProjectFileGalleryProps> = ({
  items,
  isLoading,
  selectedIds,
  onToggleSelect,
  onSelectItem,
  onAiRename,
  onLock,
  onUnlock,
  workMode = 'office',
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 p-6">
      {(isLoading || items.length === 0) && (
        <>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={`skel-${i}`} className="rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden animate-pulse">
              <div className="h-40 bg-white/[0.03]" />
              <div className="p-4 space-y-2">
                <div className="h-3 w-3/4 rounded bg-white/[0.03]" />
                <div className="h-2.5 w-1/2 rounded bg-white/[0.03]" />
              </div>
            </div>
          ))}
        </>
      )}

      {!isLoading && items.length > 0 && items.map((item) => {
        const isSelected = selectedIds.has(item.id);
        const fileType = getFileTypeFromName(item.name);

        return (
          <div
            key={item.id}
            onClick={() => onSelectItem(item.id)}
            className={`relative bg-white/[0.03] border rounded-xl overflow-hidden hover:border-white/[0.08] transition-all duration-300 cursor-pointer group/gallery ${
              isSelected
                ? 'border-archilya-gold/20 bg-archilya-gold/[0.03]'
                : 'border-white/[0.06]'
            }`}
          >
            {/* Preview area */}
            <div
              className={`relative h-40 w-full flex items-center justify-center ${PREVIEW_GRADIENT[fileType]}`}
              style={fileType === 'DWG' ? { backgroundImage: DWG_GRID_PATTERN, backgroundSize: '20px 20px' } : undefined}
            >
              {fileType === 'IMG' ? (
                <div className="w-full h-full relative overflow-hidden">
                  {/* Thumbnail-like gradient layers */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.15">
                      <rect x="2" y="2" width="20" height="20" rx="2" />
                      <circle cx="8" cy="8" r="2" />
                      <path d="M2 18l6-6 4 4 6-6 4 4" />
                    </svg>
                  </div>
                  {/* Mock filename overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-[9px] font-mono text-white/60 truncate">{item.name}</p>
                  </div>
                </div>
              ) : (
                GALLERY_ICONS[fileType]
              )}

              <div className="absolute top-2 right-2">
                <GalleryCheckbox
                  checked={isSelected}
                  onChange={() => onToggleSelect(item.id)}
                />
              </div>

              {workMode !== 'solo' && item.lockStatus !== 'unlocked' && (
                <div className={`absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-md border ${item.lockStatus === 'locked' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={item.lockStatus === 'locked' ? 'text-amber-400/70' : 'text-emerald-400/70'}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span className={`text-[9px] font-mono ${item.lockStatus === 'locked' ? 'text-amber-400/70' : 'text-emerald-400/70'}`}>
                    {item.lockStatus === 'locked' ? item.lockedBy ?? 'Kilitli' : 'Sizde'}
                  </span>
                </div>
              )}
            </div>

            {/* Card content */}
            <div className="p-4">
              <div className="flex min-w-0 items-center gap-1.5">
                <p className="text-[12px] text-archilya-text font-medium truncate">
                  {item.name}
                </p>
                {item.aiSuggestedName && (
                  <AIMagicRename
                    currentName={item.name}
                    suggestedName={item.aiSuggestedName}
                    isVisible={true}
                    onAccept={() => onAiRename?.(item.id, item.aiSuggestedName!)}
                    onReject={() => {}}
                  />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <ProjectFileTypeBadge filename={item.name} />
                <span className="text-[10px] font-mono text-archilya-text-dim/50">
                  {item.size}
                </span>
              </div>
              <p className="text-[10px] font-mono text-archilya-text-dim/40 mt-1">
                {item.date}
              </p>
              {/* Hover actions */}
              {workMode !== 'solo' && item.type === 'file' && (
                <div className="flex items-center gap-2 mt-2 opacity-0 group-hover/gallery:opacity-100 transition-opacity">
                  {item.lockStatus === 'unlocked' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onLock?.(item.id); }}
                      className="flex items-center gap-1.5 text-[10px] font-mono text-archilya-text-dim/50 hover:text-amber-400 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Kilidi Al ve Düzenle
                    </button>
                  )}
                  {item.lockStatus === 'locked_by_me' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onUnlock?.(item.id); }}
                      className="flex items-center gap-1.5 text-[10px] font-mono text-archilya-text-dim/50 hover:text-emerald-400 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><path d="M12 16v2"/></svg>
                      Kilidi Aç
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
