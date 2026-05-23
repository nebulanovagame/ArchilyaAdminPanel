import React, { useState, useEffect } from 'react';
import type { FirebaseProject, ActivityEntry, UserData } from '../../shared/types';

interface ActivityLog {
  id: string;
  type: 'sync' | 'upload' | 'download' | 'delete' | 'invite' | 'lock' | 'unlock' | 'rename' | 'status_change';
  actor: string;
  description: string;
  time: string;
  scope: 'global' | 'mine' | 'critical';
  sortValue: number;
}

type TabId = 'global' | 'mine' | 'critical';

const TAB_CONFIG: { id: TabId; label: string }[] = [
  { id: 'global', label: 'Tüm Ofis (Global)' },
  { id: 'mine', label: 'Benim Aktivitelerim' },
  { id: 'critical', label: 'Kritik Uyarılar' },
];

function ActivityIcon({ type }: { type: ActivityLog['type'] }) {
  switch (type) {
    case 'sync':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/70">
          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
          <path d="M3 21v-5h5" />
        </svg>
      );
    case 'upload':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400/70">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      );
    case 'download':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold/70">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      );
    case 'delete':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400/70">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
      );
    case 'invite':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400/70">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
      );
    case 'lock':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400/70">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      );
    case 'unlock':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/70">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
      );
    case 'rename':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-400/70">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      );
    case 'status_change':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400/70">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
  }
}

// Helper function to map ActivityEntry to ActivityLog
function mapActivityEntryToLog(entry: ActivityEntry, index: number, userDisplayName: string): ActivityLog {
  // Map action to type
  let type: ActivityLog['type'] = 'sync';
  const action = entry.action.toLowerCase();
  
  if (action.includes('upload') || action.includes('yükle')) type = 'upload';
  else if (action.includes('download') || action.includes('indir')) type = 'download';
  else if (action.includes('delete') || action.includes('sil')) type = 'delete';
  else if (action.includes('invite') || action.includes('davet')) type = 'invite';
  else if (action.includes('lock') || action.includes('kilit')) type = 'lock';
  else if (action.includes('unlock') || action.includes('aç') || action.includes('kilidi')) type = 'unlock';
  else if (action.includes('rename') || action.includes('adlandır')) type = 'rename';
  else if (action.includes('status') || action.includes('durum')) type = 'status_change';
  else if (action.includes('sync') || action.includes('senkron')) type = 'sync';

  // Determine scope
  let scope: ActivityLog['scope'] = 'global';
  if (type === 'delete' || type === 'status_change') scope = 'critical';
  else if (entry.user === userDisplayName) scope = 'mine';

  // Format time from timestamp
  const date = new Date(entry.timestamp);
  const time = Number.isNaN(date.getTime())
    ? entry.timestamp
    : date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return {
    id: `${entry.timestamp}-${index}`,
    type,
    actor: entry.user || 'Sistem',
    description: entry.details,
    time,
    scope,
    sortValue: Number.isNaN(date.getTime()) ? 0 : date.getTime(),
  };
}

interface ActivityViewProps {
  user: UserData;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<TabId>('global');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    let unsubscribeProjects: (() => void) | null = null;
    let unsubscribeError: (() => void) | null = null;

    const setupSubscriptions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Subscribe to projects
        const result = await window.api.subscribeProjects(user.uid);
        if (!result.success) {
          throw new Error('Failed to subscribe to projects');
        }

        // Listen for project changes
        unsubscribeProjects = window.api.onProjectsChanged((projects: FirebaseProject[]) => {
          // Flatten activity logs from all projects
          const allLogs: ActivityLog[] = [];
          projects.forEach((project) => {
            if (project.activityLog && Array.isArray(project.activityLog)) {
              project.activityLog.forEach((entry, index) => {
                allLogs.push(mapActivityEntryToLog(entry, index, user.displayName));
              });
            }
          });
          
          // Sort by timestamp descending (newest first)
          allLogs.sort((a, b) => b.sortValue - a.sortValue);
          
          setActivityLogs(allLogs);
          setLoading(false);
        });

        // Listen for errors
        unsubscribeError = window.api.onProjectsError((err: string) => {
          setError(err);
          setLoading(false);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    setupSubscriptions();

    // Cleanup function
    return () => {
      if (unsubscribeProjects) {
        unsubscribeProjects();
      }
      if (unsubscribeError) {
        unsubscribeError();
      }
      window.api.unsubscribeProjects();
    };
  }, [user?.uid, user.displayName]);

  const filteredLogs = activityLogs.filter((log) => {
    if (activeTab === 'global') return log.scope === 'global' || log.scope === 'mine';
    if (activeTab === 'mine') return log.actor === user.displayName;
    if (activeTab === 'critical') return log.scope === 'critical';
    return false;
  });

  const sectionLabel =
    activeTab === 'global'
      ? 'Tüm Ofis Aktiviteleri'
      : activeTab === 'mine'
        ? 'Benim Aktivitelerim'
        : 'Kritik Uyarılar';

  // Empty state component
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-text-dim/20 mb-3">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-[12px] text-archilya-text-dim/40 tracking-wide">
        Henüz bir aktivite kaydı bulunmuyor.
      </p>
    </div>
  );

  // Loading state component
  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-archilya-panel border-t-archilya-gold rounded-full animate-spin mb-3"></div>
      <p className="text-[12px] text-archilya-text-dim/40 tracking-wide">
        Aktiviteler yükleniyor...
      </p>
    </div>
  );

  // Error state component
  const ErrorState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-16">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400/50 mb-3">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
      <p className="text-[12px] text-red-400/60 tracking-wide">
        {message}
      </p>
    </div>
  );

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
      <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase mb-8">Aktivite</h1>

      {/* Devam Eden Senkronizasyonlar */}
      <div className="mb-8">
        <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">Devam Eden</p>
        <div className="space-y-4">
          <div className="rounded-xl p-5 bg-white/[0.01] border border-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/40 animate-pulse" />
                <span className="text-[11px] text-archilya-text/70 font-medium">Villa Proje Alpha</span>
              </div>
              <span className="text-[10px] font-mono text-archilya-text-dim/50">İndiriliyor · 45 MB / 120 MB</span>
            </div>
            <div className="w-full h-[2px] bg-white/[0.03] overflow-hidden rounded-full">
              <div className="h-full bg-emerald-400/30 rounded-full transition-all" style={{ width: '37%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-8">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-[11px] font-medium tracking-wide transition-all ${
              activeTab === tab.id
                ? 'bg-white/[0.06] text-archilya-gold border border-white/[0.08]'
                : 'text-archilya-text-dim/50 hover:text-archilya-text-dim/80 hover:bg-white/[0.02]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Section Label */}
      <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-text-dim/45 mb-4">
        {sectionLabel}
      </p>

      {/* Critical Warning */}
      {activeTab === 'critical' && (
        <div className="flex items-center gap-2 mb-4 px-4 py-2 rounded-lg bg-red-500/[0.06] border border-red-500/[0.1]">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400/70">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[11px] text-red-400/80 font-medium">Dikkat gerektiren işlemler</span>
        </div>
      )}

      {/* Activity List */}
      <div className="space-y-1">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} />
        ) : filteredLogs.length === 0 ? (
          <EmptyState />
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-center justify-between px-4 py-2.5 rounded-lg hover:bg-white/[0.01] transition-colors ${
                activeTab === 'critical' ? 'bg-red-500/[0.03] border border-red-500/[0.06]' : ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                <ActivityIcon type={log.type} />
                <span className="text-[12px] text-archilya-text-dim/80">
                  <span className="text-archilya-text-dim/85 font-medium">{log.actor}</span> {log.description}
                </span>
              </div>
              <span className="text-[10px] font-mono text-archilya-text-dim/35">{log.time}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
