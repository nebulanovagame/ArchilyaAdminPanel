import React, { useEffect, useRef, useState } from 'react';
import type { FirebaseProject, TeamMember, TeamRole, UserData } from '../../shared/types';

const ROLE_OPTIONS: TeamRole[] = ['Tasarımcı', 'Admin', 'Stajyer', 'Müşteri'];
const AVATAR_COLORS = [
  'bg-pink-500/15 text-pink-200 border-pink-400/20',
  'bg-archilya-gold/15 text-archilya-gold border-archilya-gold/20',
  'bg-blue-500/15 text-blue-200 border-blue-400/20',
  'bg-emerald-500/15 text-emerald-200 border-emerald-400/20',
  'bg-violet-500/15 text-violet-200 border-violet-400/20',
] as const;

interface TeamViewProps {
  user: UserData;
}

const mapRole = (role: string): TeamRole => {
  if (role === 'owner') return 'Admin';
  if (role === 'designer') return 'Tasarımcı';
  if (role === 'client') return 'Müşteri';
  return 'Tasarımcı';
};

const getAvatarColorForUid = (uid: string): string => {
  const hash = uid.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const mapProjectsToMembers = (projects: FirebaseProject[]): TeamMember[] => {
  const uniqueMembers = new Map<string, TeamMember>();

  projects.forEach((project) => {
    (project.team ?? []).forEach((member) => {
      if (!member.uid || uniqueMembers.has(member.uid)) {
        return;
      }

      uniqueMembers.set(member.uid, {
        id: member.uid,
        name: member.email.split('@')[0],
        email: member.email,
        role: mapRole(member.role),
        initials: member.email.slice(0, 2).toUpperCase(),
        avatarColor: getAvatarColorForUid(member.uid),
        status: 'online',
      });
    });
  });

  return Array.from(uniqueMembers.values());
};

const StatusDot: React.FC<{ status: TeamMember['status'] }> = ({ status }) => {
  const colorClass =
    status === 'online'
      ? 'bg-emerald-400'
      : status === 'busy'
      ? 'bg-amber-400'
      : 'bg-archilya-text-dim/30';

  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${colorClass}`} />
      <span className="text-[10px] font-mono text-archilya-text-dim/50 capitalize">
        {status === 'online' ? 'Çevrimiçi' : status === 'busy' ? 'Meşgul' : 'Çevrimdışı'}
      </span>
    </span>
  );
};

export const TeamView: React.FC<TeamViewProps> = ({ user }) => {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user.uid) {
      return;
    }

    const cleanupProjects = window.api.onProjectsChanged((projects: FirebaseProject[]) => {
      setMembers(mapProjectsToMembers(projects));
    });

    const cleanupProjectsError = window.api.onProjectsError((error: string) => {
      console.error('Team projects error:', error);
      setMembers([]);
    });

    void window.api.subscribeProjects(user.uid).catch((error) => {
      console.error('Team subscription failed:', error);
      setMembers([]);
    });

    return () => {
      cleanupProjects();
      cleanupProjectsError();
      void window.api.unsubscribeProjects();
    };
  }, [user.uid]);

  useEffect(() => {
    if (!openDropdownId) return;

    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdownId]);

  const handleRoleChange = (memberId: string, newRole: TeamRole) => {
    setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, role: newRole } : member)));
    setOpenDropdownId(null);
  };

  const handleRemoveMember = (memberId: string) => {
    if (!window.confirm('Bu uye takimdan kaldirilacak. Emin misiniz?')) return;
    setMembers((prev) => prev.filter((member) => member.id !== memberId));
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 sm:p-8">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase mb-2">
            Ekip Yönetimi
          </h1>
          <p className="text-[11px] text-archilya-text-dim/50">
            Toplam {members?.length ?? 0} üye
          </p>
        </div>
        <button className="text-[10px] font-display tracking-wider text-archilya-gold/70 hover:text-archilya-gold border border-archilya-gold/10 hover:border-archilya-gold/25 px-3 py-1.5 rounded transition-all flex-shrink-0">
          + DAVET ET
        </button>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden mt-6">
        <div className="grid grid-cols-[minmax(200px,1fr)_140px_140px_100px] gap-4 items-center px-5 py-3 text-[10px] font-mono tracking-wider text-archilya-text-dim/45 uppercase border-b border-white/[0.05]">
          <span>Üye</span>
          <span>Rol</span>
          <span>Durum</span>
          <span className="text-right">Eylemler</span>
        </div>

        {members === null ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-[minmax(200px,1fr)_140px_140px_100px] gap-4 items-center px-5 py-3 border-b border-white/[0.03] last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full skeleton-shimmer flex-shrink-0" />
                <div className="min-w-0 space-y-1.5">
                  <div className="h-3 w-28 rounded skeleton-shimmer" />
                  <div className="h-2.5 w-40 rounded skeleton-shimmer" />
                </div>
              </div>
              <div className="h-5 w-20 rounded skeleton-shimmer" />
              <div className="h-4 w-20 rounded skeleton-shimmer" />
              <div className="flex items-center justify-end gap-2">
                <div className="h-4 w-4 rounded skeleton-shimmer" />
                <div className="h-4 w-4 rounded skeleton-shimmer" />
              </div>
            </div>
          ))
        ) : members?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-archilya-text-dim/20"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p className="mt-4 text-[12px] text-archilya-text-dim/40 tracking-wide text-center">
              Henüz bir ekip üyesi bulunmuyor.
            </p>
          </div>
        ) : (
          members?.map((member) => (
            <div
              key={member.id}
              className="grid grid-cols-[minmax(200px,1fr)_140px_140px_100px] gap-4 items-center px-5 py-3 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.025] transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${member.avatarColor}`}
                >
                  <span className="text-[10px] font-display font-bold">
                    {member.initials}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] text-archilya-text font-medium truncate">
                    {member.name}
                  </p>
                  <p className="text-[10px] text-archilya-text-dim/50 truncate">
                    {member.email}
                  </p>
                </div>
              </div>

              <div className="relative" ref={openDropdownId === member.id ? dropdownRef : undefined}>
                <button
                  type="button"
                  onClick={() => setOpenDropdownId(openDropdownId === member.id ? null : member.id)}
                  className="flex items-center gap-1.5 text-[11px] text-archilya-text-dim/70 hover:text-archilya-text transition-colors"
                >
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-mono ${
                      member.role === 'Admin'
                        ? 'border-archilya-gold/20 bg-archilya-gold/[0.08] text-archilya-gold/80'
                        : member.role === 'Müşteri'
                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-400/80'
                        : 'border-white/[0.08] bg-white/[0.03] text-archilya-text-dim/60'
                    }`}
                  >
                    {member.role}
                  </span>
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
                    className="text-archilya-text-dim/40"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {openDropdownId === member.id && (
                  <div className="absolute left-0 top-full mt-1 z-[60] w-40 rounded-lg border border-white/[0.08] bg-[#101010] shadow-xl shadow-black/50 py-1">
                    {ROLE_OPTIONS.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleChange(member.id, role)}
                        className="w-full text-left px-2.5 py-1.5 text-[10px] text-archilya-text-dim/70 hover:text-archilya-text hover:bg-white/[0.03] transition-colors flex items-center gap-2"
                      >
                        {member.role === role && (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-archilya-gold"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {member.role !== role && <span className="w-3" />}
                        {role}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <StatusDot status={member.status} />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="text-archilya-text-dim/40 hover:text-archilya-gold transition-colors"
                  title="Mesaj Gönder"
                >
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
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveMember(member.id)}
                  className="text-archilya-text-dim/40 hover:text-red-400 transition-colors"
                  title="Kaldır"
                >
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
                  >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
