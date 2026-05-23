import React, { useMemo } from 'react';
import type { UserData } from '../../shared/types';
import { getCreditConfig } from '../data/credit-config';
import { getActiveSession } from '../lib/ai-session/storage';

export type NavItem =
  | 'home'
  | 'news'
  | 'projects'
  | 'boards'
  | 'ai-studio'
  | 'ai-gallery'
  | 'vr-library'
  | 'activity'
  | 'trash'
  | 'settings'
  | 'team';

interface SidebarProps {
  active: NavItem;
  onNavigate: (item: NavItem) => void;
  workMode?: 'solo' | 'office';
  user?: UserData | null;
}

const MENU_ITEMS: { id: NavItem; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: 'Ana Ekran', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>) },
  {
    id: 'news',
    label: 'Gündem',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>
    ),
  },
  { id: 'projects', label: 'Projelerim', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>) },
  { id: 'boards', label: 'Panolar', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>) },
  { id: 'ai-studio', label: 'AI Stüdyo', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>) },
  { id: 'ai-gallery', label: 'AI Galeri', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>) },
  { id: 'vr-library', label: 'VR Kütüphanesi', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 10a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><path d="M12 8v4"/></svg>) },
  { id: 'activity', label: 'Aktivite', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>) },
  { id: 'team', label: 'Ekip', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>) },
  { id: 'trash', label: 'Çöp Kutusu', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>) },
  { id: 'settings', label: 'Ayarlar', icon: (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>) },
];

const SOLO_HIDDEN_ITEMS: NavItem[] = ['boards', 'activity', 'team'];

export const Sidebar: React.FC<SidebarProps> = ({ active, onNavigate, workMode = 'office', user }) => {
  const visibleItems = workMode === 'solo'
    ? MENU_ITEMS.filter((item) => !SOLO_HIDDEN_ITEMS.includes(item.id))
    : MENU_ITEMS;

  const credit = useMemo(() => getCreditConfig(), []);
  const activeSession = useMemo(() => getActiveSession(), []);
  const hasActiveGeneration = activeSession?.status === 'generating';

  const userInitials = useMemo(() => {
    if (!user) return '?';
    if (user.displayName) return user.displayName.slice(0, 2).toUpperCase();
    return user.email?.slice(0, 2).toUpperCase() || '?';
  }, [user]);

  const userName = user?.displayName || user?.email || 'Misafir';
  const userEmail = user?.email || '';

  return (
    <aside className="w-[200px] flex-shrink-0 flex flex-col bg-[#0a0a0a] border-r border-white/[0.05]">
      <div className="h-11 flex items-center gap-2.5 px-5 pt-1">
        <div className="w-2 h-2 bg-archilya-gold rotate-45 opacity-80" />
        <span className="font-display text-[11px] tracking-[0.35em] text-archilya-text font-bold uppercase">Archilya</span>
      </div>

      <nav className="flex-1 py-6 px-2.5 space-y-1">
        {visibleItems.map((item) => {
          const isActive = active === item.id;
          const isAiStudio = item.id === 'ai-studio';
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[12px] font-medium tracking-wide transition-all duration-200 group ${isActive ? 'bg-white/[0.04] text-archilya-gold/90' : 'text-archilya-text-dim/60 hover:text-archilya-text hover:bg-white/[0.02]'}`}>
              <span className={isActive ? 'text-archilya-gold/70' : 'text-archilya-text-dim/50 group-hover:text-archilya-text/70'}>{item.icon}</span>
              <span className="flex-1 text-left">{item.label}</span>
              {isAiStudio && hasActiveGeneration && (
                <span className="w-2 h-2 rounded-full bg-archilya-gold animate-pulse" title="Devam eden AI işlemi var" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Credit Display */}
      <div className="px-4 py-2 border-t border-white/[0.05]">
        <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-md border ${credit.isLow ? 'border-red-500/20 bg-red-500/[0.06]' : 'border-white/[0.04] bg-white/[0.02]'}`}>
          <span className="text-[9px] font-mono text-archilya-text-dim/40 uppercase tracking-wider">Kredi</span>
          <span className={`text-[11px] font-display font-bold ${credit.isLow ? 'text-red-400 animate-pulse' : 'text-archilya-gold'}`}>
            {credit.balance}
          </span>
        </div>
      </div>

      {/* Work Mode Toggle */}
      <div className="px-4 py-2.5 border-t border-white/[0.05]">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-mono text-archilya-text-dim/40 uppercase tracking-wider">
            {workMode === 'solo' ? 'Solo' : 'Ofis'}
          </span>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="text-[9px] font-mono text-archilya-gold/50 hover:text-archilya-gold/80 transition-colors"
          >
            {workMode === 'solo' ? '1 Kişi' : '5+ Kişi'}
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-archilya-gold/5 border border-archilya-gold/10 flex items-center justify-center">
            <span className="text-[10px] font-display text-archilya-gold font-bold">{userInitials}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] text-archilya-text font-medium truncate">{userName}</span>
            {userEmail && (
              <span className="text-[9px] text-archilya-text-dim/50 truncate">{userEmail}</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
