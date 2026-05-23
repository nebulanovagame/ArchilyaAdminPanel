import React, { useEffect, useState } from 'react';
import type { JSX } from 'react';
import type { FileTableItem } from './ProjectFileTable';
import { ProjectFileTypeBadge } from './ProjectFileTypeBadge';
import { getFileTypeFromName } from '../projects/projectFileTypeConfig';
import type { ArchFileExtension } from '../projects/projectFileTypeConfig';
import type { FileVersion } from '../projects/projectFileVersionsMockData';

interface ProjectFileInspectorProps {
  item: FileTableItem | null;
  isOpen: boolean;
  onClose: () => void;
  isLoading?: boolean;
  versions?: FileVersion[];
  onCreateVersion?: () => void;
  onRestoreVersion?: (versionId: string) => void;
  workMode?: 'solo' | 'office';
  onCheckOut?: () => void;
  onReadOnlyOpen?: () => void;
}

type ProjectMilestoneStatus =
  | 'Taslak'
  | 'Geliştirme'
  | 'Müşteri Onayı Bekliyor'
  | 'Onaylandı';

type InspectorTab = 'details' | 'activity';

interface ActivityItem {
  id: string;
  time: string;
  actor: string;
  kind: 'person' | 'system';
  message: string;
}

const PROJECT_STATUS_OPTIONS: ProjectMilestoneStatus[] = [
  'Taslak',
  'Geliştirme',
  'Müşteri Onayı Bekliyor',
  'Onaylandı',
];

const INSPECTOR_TABS: { id: InspectorTab; label: string }[] = [
  { id: 'details', label: 'Detaylar & Notlar' },
  { id: 'activity', label: 'Etkinlik & Yorumlar' },
];

const MOCK_ACTIVITY_ITEMS: ActivityItem[] = [
  {
    id: 'a1',
    time: 'Dün',
    actor: 'Mehmet Bey',
    kind: 'person',
    message: 'v3 yüklendi, kesitler güncellendi.',
  },
  {
    id: 'a2',
    time: 'Bugün 09:00',
    actor: 'Sistem',
    kind: 'system',
    message: 'Durum Müşteri Onayı Bekliyor olarak değiştirildi.',
  },
  {
    id: 'a3',
    time: 'Bugün 11:30',
    actor: 'Ayşe Hanım',
    kind: 'person',
    message: 'Pencere detaylarını kontrol edebilir miyiz?',
  },
];

const MOCK_REMINDERS = [
  { id: '1', text: 'Revize onayı alınacak', date: 'Yarın' },
  { id: '2', text: 'Maliyet raporu hazırlanacak', date: '3 gün içinde' },
];

type SyncStatus = FileTableItem['syncStatus'];

const SYNC_STATUS_CONFIG: Record<SyncStatus, { label: string; color: string; dotColor: string }> = {
  cloud: { label: 'Bulutta', color: 'text-archilya-text-dim/50', dotColor: 'bg-archilya-text-dim/50' },
  synced: { label: 'Eşitlendi', color: 'text-emerald-400/70', dotColor: 'bg-emerald-400/70' },
  downloading: { label: 'İndiriliyor', color: 'text-archilya-gold/70', dotColor: 'bg-archilya-gold/70' },
  uploading: { label: 'Yükleniyor', color: 'text-blue-400/70', dotColor: 'bg-blue-400/70' },
};

const PREVIEW_GRADIENT: Record<ArchFileExtension, string> = {
  DWG: 'bg-gradient-to-br from-blue-900/40 to-blue-950/20',
  SKP: 'bg-gradient-to-br from-red-900/40 to-red-950/20',
  '3DS': 'bg-gradient-to-br from-purple-900/40 to-purple-950/20',
  PDF: 'bg-gradient-to-br from-rose-900/40 to-rose-950/20',
  RVT: 'bg-gradient-to-br from-cyan-900/40 to-cyan-950/20',
  IFC: 'bg-gradient-to-br from-amber-900/40 to-amber-950/20',
  DOC: 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/20',
  XLS: 'bg-gradient-to-br from-emerald-900/40 to-emerald-950/20',
  IMG: 'bg-gradient-to-br from-pink-900/40 to-pink-950/20',
  OTHER: 'bg-gradient-to-br from-white/[0.03] to-white/[0.01]',
};

const INSPECTOR_ICONS: Record<ArchFileExtension, JSX.Element> = {
  DWG: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  SKP: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <path d="M12 3L21 8.5V15.5L12 21L3 15.5V8.5Z" />
      <path d="M12 3v18M3 8.5l9 5.25m0 0L21 8.5" />
    </svg>
  ),
  '3DS': (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <path d="M12 3l9 16H3Z" />
    </svg>
  ),
  PDF: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  ),
  RVT: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <rect x="5" y="10" width="14" height="12" />
      <rect x="9" y="6" width="6" height="4" />
      <rect x="9" y="14" width="6" height="4" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  ),
  IFC: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <circle cx="12" cy="5" r="3" />
      <circle cx="5" cy="18" r="3" />
      <circle cx="19" cy="18" r="3" />
      <line x1="12" y1="8" x2="5" y2="15" />
      <line x1="12" y1="8" x2="19" y2="15" />
      <line x1="5" y1="18" x2="19" y2="18" />
    </svg>
  ),
  DOC: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <line x1="6" y1="5" x2="18" y2="5" />
      <line x1="6" y1="9" x2="18" y2="9" />
      <line x1="6" y1="13" x2="14" y2="13" />
    </svg>
  ),
  XLS: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  IMG: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  OTHER: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" opacity="0.15">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
};

const DWG_GRID_PATTERN = 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)';

const ClockIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 text-archilya-gold/50 mt-0.5 flex-shrink-0">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ProfileIcon: React.FC<{ kind: 'person' | 'system' }> = ({ kind }) => (
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
    className={`w-3.5 h-3.5 ${kind === 'system' ? 'text-archilya-text-dim/40' : 'text-archilya-gold/70'}`}
  >
    {kind === 'system' ? (
      <>
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
      </>
    ) : (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
      </>
    )}
  </svg>
);

export const ProjectFileInspector: React.FC<ProjectFileInspectorProps> = ({
  item,
  isOpen,
  onClose,
  isLoading,
  versions,
  onCreateVersion,
  onRestoreVersion,
  workMode = 'office',
  onCheckOut,
  onReadOnlyOpen,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ProjectMilestoneStatus>('Müşteri Onayı Bekliyor');
  const [activeTab, setActiveTab] = useState<InspectorTab>('details');
  const [commentText, setCommentText] = useState('');
  const [isVersionsOpen, setIsVersionsOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!item) return null;

  if (isLoading) {
    return (
      <div className="fixed right-0 top-0 h-full w-[360px] z-50 border-l border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-xl p-6 animate-pulse">
        <div className="h-48 rounded-xl bg-white/[0.03] mb-6" />
        <div className="space-y-4">
          <div className="h-4 w-3/4 rounded bg-white/[0.03]" />
          <div className="h-3 w-1/2 rounded bg-white/[0.03]" />
          <div className="h-3 w-2/3 rounded bg-white/[0.03]" />
          <div className="h-8 w-full rounded bg-white/[0.03]" />
          <div className="h-8 w-full rounded bg-white/[0.03]" />
          <div className="h-8 w-full rounded bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  const fileType = getFileTypeFromName(item.name);
  const syncCfg = SYNC_STATUS_CONFIG[item.syncStatus];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-[360px] bg-[#0e0e0e] border-l border-white/[0.06] z-50 transform transition-transform duration-300 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}
      >
        {/* Header */}
        <div className="h-14 px-5 border-b border-white/[0.03] flex items-center justify-between">
          <span className="text-[11px] font-display tracking-[0.2em] text-archilya-text uppercase">
            Dosya Detayı
          </span>
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

        {/* Status Selector */}
        <div className="px-5 pt-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-wider text-archilya-text-dim/40 uppercase">
                Proje Aşaması
              </span>
              <span className="text-[10px] font-mono text-archilya-gold/70">{selectedStatus}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PROJECT_STATUS_OPTIONS.map((status) => {
                const isActive = selectedStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setSelectedStatus(status)}
                    aria-pressed={isActive}
                    className={`h-8 rounded-lg border px-2 text-[10px] font-mono transition-all ${
                      isActive
                        ? 'border-archilya-gold/35 bg-archilya-gold/[0.10] text-archilya-gold shadow-[0_0_18px_rgba(212,175,55,0.08)]'
                        : 'border-white/[0.06] bg-white/[0.02] text-archilya-text-dim/55 hover:border-archilya-gold/20 hover:text-archilya-text'
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Preview Area */}
        <div className="px-5 pt-4">
          <div
            className={`h-48 rounded-xl overflow-hidden relative ${PREVIEW_GRADIENT[fileType]}`}
            style={fileType === 'DWG' ? { backgroundImage: DWG_GRID_PATTERN, backgroundSize: '20px 20px' } : undefined}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              {INSPECTOR_ICONS[fileType]}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
              <p className="text-[13px] text-white/90 font-medium truncate">{item.name}</p>
            </div>
          </div>
        </div>

        {/* Lock Armor Banner (Office Mode Only) */}
        {workMode === 'office' && item.type === 'file' && (
          <div className="px-5 pt-4">
            {item.lockStatus === 'locked' ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.08] p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-amber-500/[0.12]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-display tracking-wider text-amber-300 uppercase">
                      Dosya Kilitli — Check-Out Aktif
                    </p>
                    <p className="mt-1 text-[11px] text-amber-200/70">
                      {item.lockedBy} tarafından düzenleniyor
                      {item.name.endsWith('.dwg') && ' (AutoCAD .dwl aktif)'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onReadOnlyOpen}
                    className="flex-shrink-0 h-9 px-4 rounded-lg border border-amber-400/25 bg-amber-500/[0.10] text-[11px] font-display tracking-widest text-amber-300 hover:border-amber-400/45 hover:bg-amber-500/20 hover:text-amber-200 transition-all"
                  >
                    Salt Okunur Aç
                  </button>
                </div>
              </div>
            ) : item.lockStatus === 'unlocked' ? (
              <button
                type="button"
                onClick={onCheckOut}
                className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] text-[11px] font-display tracking-widest text-emerald-300 hover:border-emerald-400/40 hover:bg-emerald-500/15 hover:text-emerald-200 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Kilidi Al ve Düzenle (Check-Out)
              </button>
            ) : null}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center border-b border-white/[0.05] px-5 mt-4" role="tablist">
          {(workMode === 'solo' ? INSPECTOR_TABS.filter((t) => t.id === 'details') : INSPECTOR_TABS).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 px-2 pb-2.5 pt-1 text-[10px] font-mono tracking-wider uppercase transition-colors ${
                  isActive
                    ? 'text-archilya-gold'
                    : 'text-archilya-text-dim/45 hover:text-archilya-text/70'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[1.5px] rounded-full bg-archilya-gold/60" />
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
          {activeTab === 'details' ? (
            <>
              {/* Metadata Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                  <span className="text-[10px] font-mono tracking-wider text-archilya-text-dim/40 uppercase">Tip</span>
                  <ProjectFileTypeBadge filename={item.name} />
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                  <span className="text-[10px] font-mono tracking-wider text-archilya-text-dim/40 uppercase">Boyut</span>
                  <span className="text-[11px] font-mono text-archilya-text-dim/70">{item.size}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                  <span className="text-[10px] font-mono tracking-wider text-archilya-text-dim/40 uppercase">Senkronizasyon</span>
                  <div className={`flex items-center gap-1.5 ${syncCfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${syncCfg.dotColor}`} />
                    <span className="text-[11px] font-mono">{syncCfg.label}</span>
                  </div>
                </div>
                {workMode !== 'solo' && item.type === 'file' && (
                  <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                    <span className="text-[10px] font-mono tracking-wider text-archilya-text-dim/40 uppercase">Kilit Durumu</span>
                    <div className="flex items-center gap-1.5">
                      {item.lockStatus === 'locked' ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70" />
                          <span className="text-[11px] font-mono text-amber-400/70">
                            {item.lockedBy} tarafından kilitli
                          </span>
                        </>
                      ) : item.lockStatus === 'locked_by_me' ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
                          <span className="text-[11px] font-mono text-emerald-400/70">Sizin tarafınızdan kilitli</span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-archilya-text-dim/40" />
                          <span className="text-[11px] font-mono text-archilya-text-dim/50">Kilitsiz</span>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between py-2 border-b border-white/[0.03]">
                  <span className="text-[10px] font-mono tracking-wider text-archilya-text-dim/40 uppercase">Son Değişiklik</span>
                  <span className="text-[11px] font-mono text-archilya-text-dim/70">{item.date}</span>
                </div>
              </div>

              {/* Version History Accordion */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] overflow-hidden">
                {/* Header */}
                <button
                  type="button"
                  onClick={() => setIsVersionsOpen(!isVersionsOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
                      Versiyon Gecmisi
                    </span>
                    {versions && versions.length > 0 && (
                      <span className="text-[9px] font-mono bg-archilya-gold/[0.08] border border-archilya-gold/15 text-archilya-gold/70 px-1.5 py-0.5 rounded">
                        {versions.length}
                      </span>
                    )}
                  </div>
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
                    className={`text-archilya-text-dim/40 transition-transform duration-200 ${isVersionsOpen ? 'rotate-90' : ''}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>

                {/* Content */}
                <div className={`transition-all duration-300 ${isVersionsOpen ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                  <div className="px-3 pb-3 space-y-3">
                    {/* Create Version Button */}
                    <button
                      type="button"
                      onClick={onCreateVersion}
                      className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-archilya-gold/20 bg-archilya-gold/[0.06] text-[10px] font-display tracking-widest text-archilya-gold/80 hover:border-archilya-gold/35 hover:bg-archilya-gold/[0.10] hover:text-archilya-gold transition-all"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Yeni Versiyon Olustur
                    </button>

                    {/* Version List */}
                    {versions && versions.length > 0 ? (
                      <div className="space-y-0">
                        {versions.map((version, index) => (
                          <div key={version.id} className="relative flex gap-3 py-3 border-b border-white/[0.03] last:border-0">
                            {/* Timeline dot and line */}
                            <div className="relative flex flex-col items-center flex-shrink-0">
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
                               {version.changeNote && (
                                 <p className="text-[9px] text-archilya-gold/50 mt-0.5 truncate">
                                   “{version.changeNote}”
                                 </p>
                               )}
                               <div className="flex items-center justify-between gap-2">
                                 <span className="text-[10px] text-archilya-text-dim/40">
                                   {version.author} · {new Date(version.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                 </span>
                                 <div className="flex items-center gap-1 flex-shrink-0">
                                   <button
                                     type="button"
                                     onClick={() => {/* download */}}
                                     className="h-6 rounded border border-white/[0.06] bg-white/[0.03] px-2 text-[9px] font-mono text-archilya-text-dim/55 hover:border-white/[0.12] hover:text-archilya-text/80 transition-colors"
                                   >
                                     Indir
                                   </button>
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
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-archilya-text-dim/40 text-center py-4">
                        Henüz versiyon kaydi yok.
                      </p>
                    )}

                    {/* Summary */}
                    {versions && versions.length > 0 && (
                      <p className="text-[9px] font-mono text-archilya-text-dim/35 text-right pt-1">
                        {versions.length} versiyon · toplam {versions.reduce((acc, v) => acc + parseFloat(v.size), 0)} MB
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <label className="text-[10px] font-mono tracking-wider text-archilya-text-dim/40 uppercase mb-2 block">
                  Notlar
                </label>
                <textarea
                  placeholder="Bu dosya hakkında not ekleyin..."
                  className="w-full h-24 bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:outline-none focus:border-archilya-gold/30 transition-colors resize-none"
                />
              </div>

              {/* Reminders Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono tracking-wider text-archilya-text-dim/40 uppercase">
                    Hatırlatmalar
                  </span>
                  <button
                    type="button"
                    className="text-[10px] font-mono text-archilya-gold/70 hover:text-archilya-gold transition-colors flex items-center gap-1"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    Ekle
                  </button>
                </div>
                <input
                  type="date"
                  className="w-full h-8 px-3 rounded bg-white/[0.03] border border-white/[0.06] text-[11px] text-archilya-text focus:outline-none focus:border-archilya-gold/30 mb-3"
                />
                {MOCK_REMINDERS.map((reminder) => (
                  <div key={reminder.id} className="flex items-start gap-2 py-2 border-b border-white/[0.03] last:border-0">
                    <ClockIcon />
                    <span className="text-[11px] text-archilya-text-dim/70">{reminder.text}</span>
                    <span className="text-[10px] font-mono text-archilya-gold/60 ml-auto">{reminder.date}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Activity Stream */}
              <div className="space-y-0">
                {MOCK_ACTIVITY_ITEMS.map((activity, index) => (
                  <div key={activity.id} className="relative flex gap-3 pb-5">
                    {/* Timeline rail */}
                    {index < MOCK_ACTIVITY_ITEMS.length - 1 && (
                      <div className="absolute left-[13px] top-7 bottom-0 w-px bg-white/[0.06]" />
                    )}

                    {/* Icon */}
                    <div
                      className={`relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border ${
                        activity.kind === 'system'
                          ? 'border-white/[0.08] bg-[#111] text-archilya-text-dim/60'
                          : 'border-archilya-gold/20 bg-archilya-gold/[0.06] text-archilya-gold/70'
                      }`}
                    >
                      <ProfileIcon kind={activity.kind} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 rounded-lg border border-white/[0.05] bg-white/[0.025] p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-archilya-text/85">{activity.actor}</span>
                        <span className="shrink-0 text-[9px] font-mono text-archilya-gold/55">{activity.time}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-archilya-text-dim/70">{activity.message}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Comment Input */}
              <div className="mt-2">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2 focus-within:border-archilya-gold/25 transition-colors">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="@mention ile yorum ekle..."
                    className="min-w-0 flex-1 bg-transparent px-2 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={commentText.trim().length === 0}
                    aria-label="Yorum gönder"
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-archilya-gold/20 bg-archilya-gold/[0.08] text-archilya-gold/75 transition-colors hover:border-archilya-gold/40 hover:bg-archilya-gold/15 hover:text-archilya-gold disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};
