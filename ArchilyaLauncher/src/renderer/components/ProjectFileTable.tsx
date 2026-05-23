import React, { useState, useRef, useEffect } from 'react';
import { ProjectFileTypeBadge } from './ProjectFileTypeBadge';
import { AIMagicRename } from './AIMagicRename';
import { FilePreviewModal } from './FilePreviewModal';
import { PROJECT_FILE_VERSIONS } from '../projects/projectFileVersionsMockData';
import type { VisibilityLevel } from '../../shared/types';

export interface FileTableItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size: string;
  date: string;
  syncStatus: 'cloud' | 'synced' | 'downloading' | 'uploading';
  aiSuggestedName?: string;
  lockStatus: 'unlocked' | 'locked' | 'locked_by_me';
  lockedBy?: string;
  visibility?: VisibilityLevel;
}

interface ProjectFileTableProps {
  items: FileTableItem[];
  isLoading?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDownload?: (id: string) => void;
  onShare?: (id: string) => void;
  onOpenFolder?: (id: string) => void;
  onOpenFile?: (id: string) => void;
  onSelectItem?: (id: string) => void;
  onPreview?: (id: string) => void;
  onAiRename?: (id: string, newName: string) => void;
  onLock?: (id: string) => void;
  onUnlock?: (id: string) => void;
  onGenerateClientLink?: (id: string) => void;
  onExportToVr?: (id: string) => void;
  versionCounts?: Map<string, number>;
  workMode?: 'solo' | 'office';
}

type SyncStatus = FileTableItem['syncStatus'];

const SYNC_STATUS_CONFIG: Record<SyncStatus, { label: string; color: string }> = {
  cloud: { label: 'Bulutta', color: 'text-archilya-text-dim/50' },
  synced: { label: 'Eşitlendi', color: 'text-emerald-400/70' },
  downloading: { label: 'İndiriliyor', color: 'text-archilya-gold/70' },
  uploading: { label: 'Yükleniyor', color: 'text-blue-400/70' },
};

const SyncStatusIcon: React.FC<{ status: SyncStatus }> = ({ status }) => {
  switch (status) {
    case 'cloud':
      return <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19c0-1.7-1.3-3-3-3h-11a3 3 0 0 1-3-3c0-1.3.8-2.4 2-2.8V10a7 7 0 0 1 12.8-3.8c1.5.8 2.7 2.2 3.2 3.9.2.1.4.1.6.1a4 4 0 0 1 1.4 7.8"/></svg>;
    case 'synced':
      return <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
    case 'downloading':
      return <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>;
    case 'uploading':
      return <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>;
  }
};

const GridCheckbox: React.FC<{
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}> = ({ checked, indeterminate, onChange }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={indeterminate ? 'mixed' : checked}
    onClick={(e) => { e.stopPropagation(); onChange(); }}
    className="relative h-3.5 w-3.5 appearance-none rounded-[3px] border border-white/[0.12] bg-white/[0.02] transition-colors focus:outline-none focus:ring-1 focus:ring-archilya-gold/30"
    style={{
      backgroundColor: checked ? 'rgba(212,175,55,0.2)' : undefined,
      borderColor: checked ? 'rgba(212,175,55,0.6)' : undefined,
    }}
  >
    {checked && !indeterminate && (
      <svg className="absolute inset-0 m-auto" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgba(212,175,55,0.8)' }}>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )}
    {indeterminate && (
      <svg className="absolute inset-0 m-auto" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ color: 'rgba(212,175,55,0.6)' }}>
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    )}
  </button>
);

export const ProjectFileTable: React.FC<ProjectFileTableProps> = ({
  items,
  isLoading,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDownload,
  onShare,
  onOpenFolder,
  onOpenFile,
  onSelectItem,
  onPreview,
  onAiRename,
  onLock,
  onUnlock,
  onGenerateClientLink,
  onExportToVr,
  versionCounts,
  workMode = 'office',
}) => {
  const allSelected = items.length > 0 && selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0 && !allSelected;
  const [openWithFileId, setOpenWithFileId] = useState<string | null>(null);
  const [openVisibilityId, setOpenVisibilityId] = useState<string | null>(null);
  const [itemVisibility, setItemVisibility] = useState<Record<string, VisibilityLevel>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [previewItem, setPreviewItem] = useState<FileTableItem | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const visibilityRef = useRef<HTMLDivElement>(null);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!openWithFileId) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenWithFileId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openWithFileId]);

  useEffect(() => {
    if (!openVisibilityId) return;
    const handleClick = (e: MouseEvent) => {
      if (visibilityRef.current && !visibilityRef.current.contains(e.target as Node)) {
        setOpenVisibilityId(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openVisibilityId]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const handleGenerateClientLink = (id: string) => {
    setToast({ message: 'Link Kopyalandı', type: 'success' });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500);
    onGenerateClientLink?.(id);
  };

  const getVisibilityColor = (v: VisibilityLevel) => {
    switch (v) {
      case 'admin': return 'text-amber-400/70';
      case 'client': return 'text-emerald-400/70';
      default: return 'text-archilya-text-dim/40';
    }
  };

  const getVisibilityLabel = (v: VisibilityLevel) => {
    switch (v) {
      case 'admin': return 'Sadece Yöneticiler';
      case 'client': return 'Müşteriye Açık';
      default: return 'Tüm Ekip';
    }
  };

  return (
    <div className="flex-1 overflow-auto custom-scrollbar min-w-0 relative">
      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[90] px-5 py-2.5 rounded border text-xs font-display tracking-widest uppercase transition-all duration-300 shadow-2xl bg-emerald-500/10 border-emerald-500/40 text-emerald-400">
          {toast.message}
        </div>
      )}
      <div className="min-w-[840px]">
        {/* Header */}
        <div className="mx-6 border-b border-white/[0.05]">
          <div className="grid grid-cols-[32px_minmax(280px,1fr)_72px_80px_110px_160px] gap-4 items-center px-3 py-3 text-[10px] font-mono tracking-wider text-archilya-text-dim/45 uppercase">
            <GridCheckbox checked={allSelected} indeterminate={someSelected} onChange={onSelectAll} />
            <span>Ad</span>
            <span>Boyut</span>
            <span>Tip</span>
            <span>Durum</span>
            <span className="text-right pr-1">Son Değişiklik</span>
          </div>
        </div>

        {/* Skeleton Rows */}
        {isLoading && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`skel-${i}`} className="mx-6 my-1 grid grid-cols-[32px_minmax(280px,1fr)_72px_80px_110px_160px] items-center gap-4 rounded-lg px-3 py-3">
                <div className="h-3.5 w-3.5 rounded-[3px] skeleton-shimmer" />
                <div className="h-3 w-2/3 rounded skeleton-shimmer" />
                <div className="h-3 w-10 rounded skeleton-shimmer" />
                <div className="h-3 w-12 rounded skeleton-shimmer" />
                <div className="h-3 w-14 rounded skeleton-shimmer" />
                <div className="h-3 w-16 rounded skeleton-shimmer" />
              </div>
            ))}
          </>
        )}

        {!isLoading && items.length > 0 && items.map((item) => {
          const isSelected = selectedIds.has(item.id);
          const cfg = SYNC_STATUS_CONFIG[item.syncStatus];

          return (
            <div
              key={item.id}
              onClick={() => {
                if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = setTimeout(() => {
                  if (item.type === 'folder' && onOpenFolder) {
                    onOpenFolder(item.id);
                  } else if (item.type === 'file' && onSelectItem) {
                    onSelectItem(item.id);
                  }
                }, 200);
              }}
              onDoubleClick={() => {
                if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = null;
                if (item.type === 'file') {
                  setPreviewItem(item);
                  onPreview?.(item.id);
                }
              }}
              className={`mx-6 my-1 grid grid-cols-[32px_minmax(280px,1fr)_72px_80px_110px_160px] items-center gap-4 rounded-lg border border-transparent px-3 py-2.5 transition-colors cursor-pointer group/file-row hover:bg-white/[0.025] hover:border-white/[0.04] ${isSelected ? 'bg-archilya-gold/[0.04] border-archilya-gold/10' : ''}`}
            >
              {/* Checkbox */}
              <GridCheckbox
                checked={isSelected}
                onChange={() => onToggleSelect(item.id)}
              />

              {/* Name */}
              <div className={`min-w-0 relative ${workMode === 'office' && item.lockStatus === 'locked' ? 'flex flex-col gap-1.5' : 'flex items-center gap-2'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  {item.type === 'folder' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold/60 flex-shrink-0">
                      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.1A2 2 0 0 0 7.9 2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-text-dim/40 flex-shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  )}
                  {workMode === 'office' && item.lockStatus !== 'unlocked' && (
                    <span className="hidden lg:inline text-[10px] font-mono text-amber-400/60 ml-1 truncate">
                      {item.lockedBy
                        ? `· ${item.lockedBy} tarafindan duzenleniyor`
                        : '· Kilitli'}
                    </span>
                  )}
                  {workMode === 'solo' && item.type === 'file' && (
                    <span className={`flex-shrink-0 ${cfg.color}`}>
                      <SyncStatusIcon status={item.syncStatus} />
                    </span>
                  )}
                  <span className="text-[12px] text-archilya-text-dim/80 truncate" title={item.name}>{item.name}</span>
                  {item.type === 'file' && versionCounts?.get(item.id) && versionCounts.get(item.id)! > 0 && (
                    <span className="text-[9px] font-mono bg-archilya-gold/[0.08] border border-archilya-gold/15 text-archilya-gold/70 px-1.5 py-0.5 rounded flex-shrink-0">
                      v{versionCounts.get(item.id)}
                    </span>
                  )}
                  {workMode === 'office' && item.lockStatus !== 'unlocked' && (
                    <span className="hidden lg:inline text-[10px] font-mono text-amber-400/60 ml-1 truncate">
                      {workMode === 'solo'
                        ? `· Bu dosya [MacBook_Pro] cihazinizda acik`
                        : item.lockedBy
                          ? `· ${item.lockedBy} tarafindan duzenleniyor`
                          : '· Kilitli'}
                    </span>
                  )}
                  {/* Visibility Eye Icon */}
                  {workMode !== 'solo' && (
                    <div className="relative" ref={openVisibilityId === item.id ? visibilityRef : undefined}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenVisibilityId(openVisibilityId === item.id ? null : item.id); }}
                        className={`flex-shrink-0 transition-colors hover:text-archilya-gold ${getVisibilityColor(itemVisibility[item.id] || item.visibility || 'team')}`}
                        title={getVisibilityLabel(itemVisibility[item.id] || item.visibility || 'team')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      </button>
                      {openVisibilityId === item.id && (
                        <div className="absolute left-0 top-full mt-1 z-[60] w-52 rounded-lg border border-white/[0.08] bg-[#101010] shadow-xl shadow-black/50 py-1">
                          {(['team', 'admin', 'client'] as VisibilityLevel[]).map((level) => (
                            <button
                              key={level}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setItemVisibility((prev) => ({ ...prev, [item.id]: level }));
                                setOpenVisibilityId(null);
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-[10px] text-archilya-text-dim/70 hover:text-archilya-text hover:bg-white/[0.03] transition-colors flex items-center gap-2"
                            >
                              {(itemVisibility[item.id] || item.visibility || 'team') === level ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              ) : (
                                <span className="w-3" />
                              )}
                              {level === 'team' && 'Tüm Ekip Görebilir'}
                              {level === 'admin' && 'Sadece Yöneticiler'}
                              {level === 'client' && 'Müşteriye Açık (Salt Okunur)'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                {/* Office Mode: Massive Lock Warning Badge */}
                {workMode === 'office' && item.lockStatus === 'locked' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-400/25 bg-amber-500/[0.10] w-fit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 flex-shrink-0">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span className="text-[11px] font-display tracking-wider text-amber-300">
                      {item.lockedBy} tarafından düzenleniyor
                      {item.name.endsWith('.dwg') && ' (AutoCAD .dwl aktif)'}
                    </span>
                  </div>
                )}
              </div>

              {/* Size */}
              <span className="text-[11px] font-mono text-archilya-text-dim/50">{item.size}</span>

              {/* Type */}
              <ProjectFileTypeBadge filename={item.name} />

              {/* Status */}
              <div className={`flex items-center gap-1.5 text-[10px] font-mono tracking-wider ${cfg.color}`}>
                <SyncStatusIcon status={item.syncStatus} />
                <span>{cfg.label}</span>
              </div>

              {/* Date + Hover Actions */}
              <div className="relative flex items-center justify-end min-w-0 h-7">
                <span className="text-[11px] font-mono text-archilya-text-dim/45 truncate">{item.date}</span>
                <div className="absolute inset-y-0 right-0 flex items-center gap-1 opacity-0 transition-opacity group-hover/file-row:opacity-100 group-focus-within/file-row:opacity-100 bg-[#0e0e0e]/90 pl-3">
                  {item.type === 'file' && onOpenFile && (
                    <div className="relative" ref={openWithFileId === item.id ? dropdownRef : undefined}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenWithFileId(openWithFileId === item.id ? null : item.id); }}
                        className="h-7 rounded border border-emerald-400/20 bg-emerald-500/[0.06] px-2 text-[10px] font-mono text-emerald-400/80 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-300 transition-colors whitespace-nowrap"
                      >
                        Aç
                      </button>
                      {openWithFileId === item.id && (
                        <div className="absolute right-0 top-full mt-1 z-[60] w-44 rounded-lg border border-white/[0.08] bg-[#101010] shadow-xl shadow-black/50 py-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setPreviewItem(item); setOpenWithFileId(null); }}
                            className="w-full text-left px-2.5 py-1.5 text-[10px] text-archilya-gold/80 hover:text-archilya-gold hover:bg-white/[0.03] transition-colors flex items-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                              <circle cx="12" cy="12" r="3"/>
                            </svg>
                            Önizle
                          </button>
                          <div className="border-t border-white/[0.06] my-1" />
                          <p className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider text-archilya-text-dim/40">Uygulama Sec</p>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onOpenFile(item.id); setOpenWithFileId(null); }}
                            className="w-full text-left px-2.5 py-1.5 text-[10px] text-archilya-text-dim/70 hover:text-archilya-text hover:bg-white/[0.03] transition-colors"
                          >
                            Varsayilan Uygulama ile Ac
                          </button>
                          {item.name.endsWith('.dwg') && (
                            <>
                              <button type="button" onClick={(e) => { e.stopPropagation(); onOpenFile(item.id); setOpenWithFileId(null); }} className="w-full text-left px-2.5 py-1.5 text-[10px] text-archilya-text-dim/70 hover:text-archilya-text hover:bg-white/[0.03] transition-colors">AutoCAD ile Ac</button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); onOpenFile(item.id); setOpenWithFileId(null); }} className="w-full text-left px-2.5 py-1.5 text-[10px] text-archilya-text-dim/70 hover:text-archilya-text hover:bg-white/[0.03] transition-colors">BricsCAD ile Ac</button>
                            </>
                          )}
                          {item.name.endsWith('.skp') && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenFile(item.id); setOpenWithFileId(null); }} className="w-full text-left px-2.5 py-1.5 text-[10px] text-archilya-text-dim/70 hover:text-archilya-text hover:bg-white/[0.03] transition-colors">SketchUp ile Ac</button>
                          )}
                          {item.name.endsWith('.rvt') && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenFile(item.id); setOpenWithFileId(null); }} className="w-full text-left px-2.5 py-1.5 text-[10px] text-archilya-text-dim/70 hover:text-archilya-text hover:bg-white/[0.03] transition-colors">Revit ile Ac</button>
                          )}
                          {item.name.endsWith('.pdf') && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenFile(item.id); setOpenWithFileId(null); }} className="w-full text-left px-2.5 py-1.5 text-[10px] text-archilya-text-dim/70 hover:text-archilya-text hover:bg-white/[0.03] transition-colors">Adobe Acrobat ile Ac</button>
                          )}
                          <div className="border-t border-white/[0.06] my-1" />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleGenerateClientLink(item.id); setOpenWithFileId(null); }}
                            className="w-full text-left px-2.5 py-1.5 text-[10px] text-emerald-400/80 hover:text-emerald-300 hover:bg-white/[0.03] transition-colors flex items-center gap-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                            </svg>
                            Müşteri Linki Oluştur (Salt Okunur)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {onDownload && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDownload(item.id); }}
                      className="h-7 rounded border border-white/[0.06] bg-white/[0.03] px-2 text-[10px] font-mono text-archilya-text-dim/60 hover:border-archilya-gold/20 hover:text-archilya-gold transition-colors whitespace-nowrap"
                    >
                      İndir
                    </button>
                  )}
                  {onShare && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onShare(item.id); }}
                      className="h-7 rounded border border-white/[0.06] bg-white/[0.03] px-2 text-[10px] font-mono text-archilya-text-dim/60 hover:border-archilya-gold/20 hover:text-archilya-gold transition-colors whitespace-nowrap"
                    >
                      Paylaş
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleGenerateClientLink(item.id); }}
                    className="h-7 rounded border border-white/[0.06] bg-white/[0.03] px-2 text-[10px] font-mono text-archilya-text-dim/60 hover:border-emerald-400/30 hover:text-emerald-400 transition-colors whitespace-nowrap"
                  >
                    Müşteri Linki
                  </button>
                  {item.type === 'file' && (item.name.endsWith('.rvt') || item.name.endsWith('.skp')) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onExportToVr?.(item.id); }}
                      className="h-7 rounded border border-indigo-400/20 bg-indigo-500/[0.06] px-2 text-[10px] font-mono text-indigo-300 hover:border-indigo-400/40 hover:bg-indigo-500/15 hover:text-indigo-200 transition-colors whitespace-nowrap"
                      title="VR Kütüphanesine Aktar"
                    >
                      <span className="flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                        VR Kütüphanesine Aktar
                      </span>
                    </button>
                  )}
                  {workMode !== 'solo' && item.type === 'file' && item.lockStatus === 'unlocked' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onLock?.(item.id); }}
                      className="h-7 rounded border border-amber-400/20 bg-amber-500/[0.06] px-2 text-[10px] font-mono text-amber-400/80 hover:border-amber-400/40 hover:bg-amber-500/15 hover:text-amber-300 transition-colors whitespace-nowrap"
                    >
                      Kilidi Al ve Düzenle
                    </button>
                  )}
                  {workMode !== 'solo' && item.type === 'file' && item.lockStatus === 'locked_by_me' && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onUnlock?.(item.id); }}
                      className="h-7 rounded border border-emerald-400/20 bg-emerald-500/[0.06] px-2 text-[10px] font-mono text-emerald-400/80 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-300 transition-colors whitespace-nowrap"
                    >
                      Kilidi Aç
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <FilePreviewModal
          item={previewItem}
          isOpen={previewItem !== null}
          onClose={() => setPreviewItem(null)}
          versions={previewItem ? (PROJECT_FILE_VERSIONS.get(previewItem.id) ?? []) : []}
          onRestoreVersion={(versionId) => console.log('Restore version', versionId)}
        />
      </div>
    </div>
  );
};
