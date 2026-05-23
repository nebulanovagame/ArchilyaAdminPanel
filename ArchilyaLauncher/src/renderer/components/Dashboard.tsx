import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useGameUpdater } from '../hooks/useGameUpdater';
import type { UserData, FirebaseProject, CreateProjectData, VrProject, SyncStatus } from '../../shared/types';
import { ProjectCard } from './ProjectCard';
import { VrProjectCard } from './VrProjectCard';
import { AddProjectModal } from './AddProjectModal';
import { LaunchModePanel } from './LaunchModePanel';
import { StreamingStatusCard } from './StreamingStatusCard';
import { ConfirmModal } from './ConfirmModal';
import { useStreamingSession } from '../hooks/useStreamingSession';
import { MachineIdentityCard } from './MachineIdentityCard';
import { CommandHistoryPanel } from './CommandHistoryPanel';
import type { MachineIdentityInfo, RemoteCommandHistoryEntry } from '../../shared/remoteCommandTypes';

interface DashboardProps {
  user: UserData;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [version, setVersion]                         = useState('');
  const [launcherUpdate, setLauncherUpdate]           = useState<{ status: string; progress?: number } | null>(null);
  
  // Firebase Mimari Projeler
  const [projects, setProjects]                       = useState<FirebaseProject[]>([]);
  const [projectsLoading, setProjectsLoading]         = useState(true);
  const [showAddModal, setShowAddModal]               = useState(false);
  const [addLoading, setAddLoading]                   = useState(false);
  
  // VR Projeler (products)
  const [vrProjects, setVrProjects]                   = useState<VrProject[]>([]);
  const [vrProjectsLoading, setVrProjectsLoading]     = useState(true);
  
  const [notification, setNotification]               = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [syncStatuses, setSyncStatuses]               = useState<Record<string, SyncStatus>>({});
  const [showOutdatedConfirm, setShowOutdatedConfirm] = useState(false);
  const [activeTab, setActiveTab]                     = useState<'architectural' | 'vr'>('vr');
  const [machineIdentity, setMachineIdentity]         = useState<MachineIdentityInfo | null>(null);
  const [commandHistory, setCommandHistory]           = useState<RemoteCommandHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const notifTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { status, progress, statusMessage, checkForUpdates, startGameUpdate, launchGame } = useGameUpdater();
  const {
    status: streamingStatus,
    loading: streamingLoading,
    error: streamingError,
    start: startWebShare,
    stop: stopWebShare,
    copyPublicUrl,
  } = useStreamingSession();

  // ── Bildirim göster ────────────────────────────────────────────────────────
  const showNotification = useCallback((type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    notifTimeoutRef.current = setTimeout(() => setNotification(null), 3500);
  }, []);

  const loadMachineIdentity = useCallback(async () => {
    try {
      const identity = await window.api.getMachineIdentity();
      setMachineIdentity(identity);
    } catch {
      showNotification('error', 'Cihaz kimliği alınamadı.');
    }
  }, [showNotification]);

  const refreshCommandHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const history = await window.api.getRemoteCommandHistory(30);
      setCommandHistory(history);
    } catch {
      showNotification('error', 'Komut geçmişi alınamadı.');
    } finally {
      setHistoryLoading(false);
    }
  }, [showNotification]);

  const handleCopyMachineId = useCallback(async () => {
    if (!machineIdentity?.machineId) {
      showNotification('error', 'Kopyalanacak cihaz kimliği bulunamadı.');
      return;
    }

    try {
      await navigator.clipboard.writeText(machineIdentity.machineId);
      showNotification('success', 'Cihaz kimliği panoya kopyalandı.');
    } catch {
      showNotification('error', 'Cihaz kimliği kopyalanamadı.');
    }
  }, [machineIdentity?.machineId, showNotification]);

  useEffect(() => {
    void loadMachineIdentity();
    void refreshCommandHistory();

    const timer = window.setInterval(() => {
      void refreshCommandHistory();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadMachineIdentity, refreshCommandHistory]);

  // ── Firebase projeleri dinle ───────────────────────────────────────────────
  useEffect(() => {
    window.api.getAppVersion().then(setVersion);

    // Launcher update dinle
    const cleanLauncherUpdate = window.api.onLauncherUpdateStatus((data: any) => {
      setLauncherUpdate({ status: data.status, progress: data.progress });
    });

    // Misafir Kullanıcılar için UID yok → boş liste göster
    if (user.isGuest) {
      setProjectsLoading(false);
      return () => { cleanLauncherUpdate(); };
    }

    // Projeleri real-time dinlemeye başla
    window.api.subscribeProjects(user.uid);

    const cleanProjects = window.api.onProjectsChanged((newProjects) => {
      setProjects(newProjects);
      setProjectsLoading(false);
    });

    const cleanProjectsError = window.api.onProjectsError((err) => {
      console.error('Projects error:', err);
      setProjectsLoading(false);
      showNotification('error', 'Projeler yüklenemedi: ' + err);
    });

    return () => {
      cleanLauncherUpdate();
      cleanProjects();
      cleanProjectsError();
      window.api.unsubscribeProjects();
    };
  }, [user.uid, user.isGuest, showNotification]);

  // ── VR Projeleri yükle (owned_project_ids → products) ────────────────────────
  useEffect(() => {
    (async () => {
      setVrProjectsLoading(true);
      try {
        const vrProjs = await window.api.getProjects();
        setVrProjects(vrProjs);
      } catch (err) {
        console.error('VR Projects error:', err);
        showNotification('error', 'Archilya projeleri yüklenemedi.');
      } finally {
        setVrProjectsLoading(false);
      }
    })();

    // projects-updated event dinle
    const cleanVrUpdated = window.api.onProjectsUpdated((vrProjs) => {
      setVrProjects(vrProjs);
    });
    return () => cleanVrUpdated();
  }, [user.isGuest, showNotification]);

  // ── Mimari proje dosyalarini arkaplanda senkronize et ─────────────────────
  useEffect(() => {
    if (user.isGuest || projects.length === 0) return;

    window.api.syncAllProjects().catch((err: any) => {
      console.error('syncAllProjects error:', err);
      showNotification('error', 'Dosya senkronizasyonu baslatilamadi.');
    });
  }, [projects.length, user.isGuest, showNotification]);

  // ── Sync event bridge: focus + network + progress merkez durumu ───────────
  useEffect(() => {
    if (user.isGuest) return;

    const cleanSyncProgress = window.api.onSyncProgress((status: SyncStatus) => {
      setSyncStatuses((prev) => ({ ...prev, [status.projectId]: status }));
    });

    const onOnline = () => {
      window.api.notifySyncOnline().catch(() => undefined);
    };

    const onFocus = () => {
      window.api.notifySyncFocus().catch(() => undefined);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);

    return () => {
      cleanSyncProgress();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
    };
  }, [user.isGuest]);

  // ── Proje ekle ─────────────────────────────────────────────────────────────
  const handleAddProject = async (data: CreateProjectData) => {
    setAddLoading(true);
    const result = await window.api.addProject(data);
    setAddLoading(false);
    if (result.success) {
      setShowAddModal(false);
      showNotification('success', `"${data.name}" projesi oluşturuldu.`);
    } else {
      showNotification('error', result.error || 'Proje oluşturulamadı.');
    }
  };

  // ── Proje sil ─────────────────────────────────────────────────────────────
  const handleDeleteProject = async (projectId: string, projectName: string) => {
    const result = await window.api.deleteProject(projectId);
    if (result.success) {
      showNotification('success', `"${projectName}" çöp kutusuna taşındı.`);
    } else {
      showNotification('error', result.error || 'Proje silinemedi.');
    }
  };

  // ── Archilya buton mantığı ────────────────────────────────────────────────
  const handleMainAction = () => {
    if (status === 'not-installed' || status === 'update-available' || status === 'error') {
      if (status === 'update-available') {
        setShowOutdatedConfirm(true);
        return;
      }
      startGameUpdate();
    } else if (status === 'ready' || status === 'offline-ready') {
      launchGame();
    } else if (status === 'maintenance') {
      checkForUpdates();
    }
  };

  const handleForceLaunchOutdated = () => {
    setShowOutdatedConfirm(false);
    launchGame({ allowOutdated: true });
  };

  const handleVrLaunch = useCallback(() => {
    showNotification('error', 'VR baslatmak icin sagdaki proje kartlarindaki VR aksiyonunu kullanin.');
  }, [showNotification]);

  const handleProjectStartWebShare = useCallback(async (mapName?: string) => {
    if (!mapName?.trim()) {
      showNotification('error', 'Web paylaşımı için proje kartından bir Archilya projesi seçin.');
      return;
    }

    const result = await startWebShare(mapName);
    if (result.success) {
      showNotification('success', result.message || 'Web ile paylaşım başlatıldı.');
      return;
    }

    showNotification('error', result.message || 'Web ile paylaşım başlatılamadı.');
  }, [startWebShare, showNotification]);

  const handleStopWebShare = useCallback(async () => {
    const result = await stopWebShare();
    if (result.success) {
      showNotification('success', result.message || 'Web ile paylaşım durduruldu.');
      return;
    }

    showNotification('error', result.message || 'Web ile paylaşım durdurulamadı.');
  }, [stopWebShare, showNotification]);

  const handleCopyPublicUrl = useCallback(async () => {
    try {
      await copyPublicUrl();
      if (streamingStatus.publicUrl || streamingStatus.lastSuccessfulUrl) {
        showNotification('success', 'Public URL panoya kopyalandı.');
      }
    } catch {
      showNotification('error', 'URL kopyalanamadı.');
    }
  }, [copyPublicUrl, showNotification, streamingStatus.lastSuccessfulUrl, streamingStatus.publicUrl]);

  // İstatistikler
  const totalFiles = projects.reduce((acc, p) => acc + (p.files?.length || 0), 0);
  const syncStatusList = Object.values(syncStatuses);
  const syncingCount = syncStatusList.filter((s) => s.status === 'syncing').length;
  const pendingCount = syncStatusList.reduce((acc, s) => acc + (s.pendingChanges || 0), 0);

  useEffect(() => {
    return () => {
      if (notifTimeoutRef.current) clearTimeout(notifTimeoutRef.current);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col relative p-5 h-full overflow-hidden gap-4">

      {/* LAUNCHER UPDATE OVERLAY */}
      {launcherUpdate && launcherUpdate.status !== 'none' && launcherUpdate.status !== 'error' && (
        <div className="absolute inset-0 z-[100] bg-archilya-dark/90 backdrop-blur-md flex flex-col items-center justify-center">
          <h2 className="font-display text-2xl text-archilya-gold mb-4 tracking-widest animate-pulse">
            LAUNCHER GÜNCELLENİYOR
          </h2>
          {(launcherUpdate.status === 'downloading' || launcherUpdate.status === 'downloaded') && (
            <div className="w-64 h-[1px] bg-archilya-panel relative overflow-hidden">
              <div
                className="absolute h-full bg-archilya-gold transition-all duration-300"
                style={{ width: `${launcherUpdate.progress || 0}%` }}
              />
            </div>
          )}
          <p className="mt-4 font-body text-xs text-archilya-text-dim tracking-widest">
            {launcherUpdate.status === 'checking'   && 'KONTROL EDİLİYOR...'}
            {launcherUpdate.status === 'available'  && 'GÜNCELLEME HAZIRLANIYOR...'}
            {launcherUpdate.status === 'downloading' && `İNDİRİLİYOR... %${launcherUpdate.progress || 0}`}
            {launcherUpdate.status === 'downloaded' && 'YÜKLENİYOR...'}
          </p>
        </div>
      )}

      {/* TOAST BİLDİRİM */}
      {notification && (
        <div className={`
          absolute top-4 left-1/2 -translate-x-1/2 z-[90]
          px-5 py-2.5 rounded border text-xs font-display tracking-widest uppercase
          transition-all duration-300 shadow-2xl
          ${notification.type === 'success'
            ? 'bg-archilya-gold/10 border-archilya-gold/40 text-archilya-gold'
            : 'bg-red-500/10 border-red-500/40 text-red-400'}
        `}>
          {notification.message}
        </div>
      )}

      {/* ANA LAYOUT */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.95fr)] gap-4">
        <div className="min-h-0 control-card rounded p-4 flex flex-col overflow-hidden">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <h1 className="font-display text-2xl tracking-[0.18em] text-archilya-text">ARCHILYA</h1>
              <p className="mt-1 text-[10px] uppercase tracking-[0.35em] text-archilya-gold/70">Mimari Simulasyon</p>
              {version && (
                <p className="mt-2 font-mono text-[10px] text-archilya-text-dim/70">v{version}</p>
              )}
            </div>

            <div className="text-right">
              <p className="text-[10px] text-archilya-gold uppercase tracking-widest">GIRIS YAPILDI</p>
              <p className="mt-1 text-xs text-archilya-text font-mono">{user.displayName || user.email}</p>
              <button
                onClick={onLogout}
                className="mt-2 text-[10px] text-red-400 hover:text-red-300 uppercase tracking-wider hover:underline"
              >
                CIKIS
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex max-w-full rounded border border-white/10 overflow-hidden">
              <button
                onClick={() => setActiveTab('architectural')}
                className={`px-4 h-9 text-[10px] tracking-[0.18em] uppercase transition-colors ${
                  activeTab === 'architectural'
                    ? 'bg-archilya-gold text-black'
                    : 'text-archilya-text-dim hover:text-archilya-text hover:bg-white/5'
                }`}
              >
                Mimari Projeler
              </button>
                <button
                  onClick={() => setActiveTab('vr')}
                className={`px-4 h-9 text-[10px] tracking-[0.18em] uppercase transition-colors ${
                  activeTab === 'vr'
                    ? 'bg-emerald-500 text-black'
                    : 'text-archilya-text-dim hover:text-archilya-text hover:bg-white/5'
                }`}
                >
                  ARCHILYA PROJELERİ
                </button>
            </div>

            {activeTab === 'architectural' && !user.isGuest && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 text-[10px] font-display tracking-widest text-archilya-gold/70 hover:text-archilya-gold border border-archilya-gold/20 hover:border-archilya-gold/50 px-2.5 py-1 rounded transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                YENI PROJE
              </button>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono uppercase tracking-wider">
            {activeTab === 'architectural' ? (
              <>
                <span className="text-archilya-gold/60">{projects.length} proje</span>
                <span className="text-archilya-text-dim/60">{totalFiles} dosya</span>
                <span className="text-emerald-400/60">{syncingCount > 0 ? `${syncingCount} sync` : 'sync idle'}</span>
                <span className="text-amber-400/60">{pendingCount} bekleyen</span>
              </>
            ) : (
              <>
                <span className="text-emerald-400/60">{vrProjects.length} proje</span>
                <span className="text-archilya-text-dim/60">Sunuma hazir liste</span>
              </>
            )}
          </div>

          <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
            {activeTab === 'architectural' ? (
              projectsLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-archilya-panel/30 border border-white/5 rounded animate-pulse" />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="h-full min-h-40 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-lg opacity-60 gap-2 px-4 text-center">
                  <p className="text-[11px] uppercase tracking-widest text-archilya-text-dim">
                    {user.isGuest ? 'Mimari projeleri gormek icin giris yapin.' : 'Henuz mimari proje yok.'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 pb-2">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onDelete={handleDeleteProject}
                      onNotification={showNotification}
                      onStartWebShare={handleProjectStartWebShare}
                    />
                  ))}
                </div>
              )
            ) : vrProjectsLoading ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-archilya-panel/30 border border-white/5 rounded animate-pulse" />
                ))}
              </div>
            ) : vrProjects.length === 0 ? (
                <div className="h-full min-h-40 flex flex-col items-center justify-center border border-dashed border-emerald-400/20 rounded-lg opacity-70 gap-2 px-4 text-center">
                  <p className="text-[11px] uppercase tracking-widest text-emerald-300/70">
                    Henuz Archilya projesi listelenmedi.
                  </p>
                <p className="text-[10px] text-archilya-text-dim/70 tracking-wide">
                  Demo havuzu ve size ozel projeler burada gorunur.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 pb-2">
                {vrProjects.map((vrProj) => (
                  <VrProjectCard
                    key={vrProj.id}
                    project={vrProj}
                    isGameRunning={status === 'playing'}
                    onNotification={showNotification}
                    onStartWebShare={handleProjectStartWebShare}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto pr-1 custom-scrollbar space-y-3 xl:max-w-[420px]">
          <div className="control-card rounded p-4 border-l-2 border-l-archilya-gold/50">
            <p className="font-mono text-[9px] text-archilya-gold/70 uppercase tracking-widest mb-2">Sistem Durumu</p>
            <p className={`font-display text-sm tracking-wide ${status === 'error' ? 'text-red-500' : 'text-archilya-text'}`}>
              {statusMessage.toUpperCase()}
            </p>
            {(status === 'downloading' || status === 'verifying' || status === 'extracting') && (
              <div className="mt-3">
                <div className="w-full h-[1px] bg-white/10 relative overflow-hidden">
                  <div
                    className="absolute h-full bg-archilya-gold transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <LaunchModePanel
            gameStatus={status}
            progress={progress}
            onPrimaryAction={handleMainAction}
            onVrAction={handleVrLaunch}
            onStartWebShare={() => {
              void handleProjectStartWebShare();
            }}
            onStopWebShare={() => {
              void handleStopWebShare();
            }}
            isWebShareActive={streamingStatus.state === 'running' || streamingStatus.state === 'starting'}
            webShareLoading={streamingLoading}
          />

          <StreamingStatusCard
            status={streamingStatus}
            loading={streamingLoading}
            error={streamingError}
            onStart={() => {
              void handleProjectStartWebShare();
            }}
            onStop={() => {
              void handleStopWebShare();
            }}
            onCopyUrl={handleCopyPublicUrl}
          />

          <MachineIdentityCard
            identity={machineIdentity}
            onCopy={handleCopyMachineId}
          />

          <CommandHistoryPanel
            entries={commandHistory}
            loading={historyLoading}
            onRefresh={refreshCommandHistory}
          />
        </div>
      </div>

      {/* YENİ PROJE MODALİ */}
      {showAddModal && (
        <AddProjectModal
          loading={addLoading}
          onSubmit={handleAddProject}
          onClose={() => setShowAddModal(false)}
        />
      )}

      <ConfirmModal
        isOpen={showOutdatedConfirm}
        title="Guncelleme Mevcut"
        message="Yeni bir surum bulundu. Simdi baslatirsaniz eski surumle devam edersiniz. Yine de baslatmak istiyor musunuz?"
        confirmText="Yine de Baslat"
        cancelText="Guncelle"
        onConfirm={handleForceLaunchOutdated}
        onCancel={() => {
          setShowOutdatedConfirm(false);
          startGameUpdate();
        }}
      />
    </div>
  );
};
