import React, { useState, useEffect, useCallback } from 'react';
import type {
  FirebaseProject,
  FirebaseProjectStatus,
  ProjectFile,
  PakStatus,
  SyncStatus,
} from '../../shared/types';

// ── Proje durum badge config'i ──────────────────────────────────────────────
const STATUS_CONFIG: Record<FirebaseProjectStatus, { label: string; color: string; dot: string }> = {
  'Aktif':       { label: 'AKTİF',       color: 'text-emerald-400',     dot: 'bg-emerald-400' },
  'Taslak':      { label: 'TASLAK',      color: 'text-archilya-gold/70', dot: 'bg-archilya-gold/70' },
  'İncelemede':  { label: 'İNCELEMEDE', color: 'text-blue-400',         dot: 'bg-blue-400' },
  'Tamamlandı':  { label: 'TAMAMLANDI', color: 'text-archilya-text-dim', dot: 'bg-archilya-text-dim' },
};

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ── Spinner SVG ──────────────────────────────────────────────────────────────
const Spinner = ({ cls = 'w-3 h-3' }: { cls?: string }) => (
  <svg className={`animate-spin ${cls}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path  className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

// ── Props ─────────────────────────────────────────────────────────────────────
interface ProjectCardProps {
  project:        FirebaseProject;
  onDelete:       (projectId: string, projectName: string) => Promise<void>;
  onNotification: (type: 'success' | 'error', message: string) => void;
  onStartWebShare?: (mapName: string) => Promise<void>;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onDelete, onNotification, onStartWebShare }) => {

  // ── Dosya yükleme state ──
  const [uploading,     setUploading]     = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  // ── Proje silme state ──
  const [deleting,    setDeleting]    = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Dosya listesi aç/kapat ──
  const [expanded, setExpanded] = useState(false);

  // ── PAK / VR Build state ──
  const [pakStatus,      setPakStatus]      = useState<PakStatus>('checking');
  const [pakProgress,    setPakProgress]    = useState(0);
  const [pakStatusMsg,   setPakStatusMsg]   = useState('');
  const [installedVer,   setInstalledVer]   = useState<string | null>(null);
  const [latestVer,      setLatestVer]      = useState<string | null>(null);

  // ── Sync state ──
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);

  const hasPaks   = project.pak_files && project.pak_files.length > 0;
  const hasMapName = project.map_name && project.map_name.trim() !== '';
  const statusCfg  = STATUS_CONFIG[project.status] ?? STATUS_CONFIG['Taslak'];

  // ── PAK durumunu kontrol et ──────────────────────────────────────────────
  const checkPakStatus = useCallback(async () => {
    if (!hasPaks) {
      setPakStatus('not-installed');
      return;
    }
    setPakStatus('checking');
    const version = project.pak_files[0]?.version || '1.0.0';
    const result  = await window.api.checkPakStatus(project.id, project.pak_files, version);
    setPakStatus(result.status as PakStatus);
    setInstalledVer(result.installedVersion);
    setLatestVer(result.latestVersion);
  }, [project.id, project.pak_files, hasPaks]);

  useEffect(() => {
    checkPakStatus();
  }, [checkPakStatus]);

  useEffect(() => {
    let mounted = true;

    window.api.getSyncStatus(project.id)
      .then((status: SyncStatus) => {
        if (!mounted) return;
        setSyncing(status.status === 'syncing');
        setSyncProgress(status.progress || 0);
      })
      .catch(() => undefined);

    const cleanSync = window.api.onSyncProgress((status: SyncStatus) => {
      if (status.projectId !== project.id) return;
      setSyncing(status.status === 'syncing');
      setSyncProgress(status.progress || 0);
    });

    return () => {
      mounted = false;
      cleanSync();
    };
  }, [project.id]);

  // ── PAK indir ────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!hasPaks) {
      onNotification('error', 'Bu projeye henüz PAK dosyası eklenmemiş.');
      return;
    }
    setPakStatus('downloading');
    setPakProgress(0);
    setPakStatusMsg('Başlatılıyor...');

    const cleanProgress = window.api.onPakDownloadProgress((data) => {
      if (data.projectId === project.id) {
        setPakProgress(data.progress);
        setPakStatusMsg(data.status);
      }
    });
    const cleanComplete = window.api.onPakDownloadComplete((data) => {
      if (data.projectId === project.id) {
        cleanProgress();
        cleanComplete();
        cleanError();
        setPakProgress(100);
        setPakStatus('installed');
        setInstalledVer(project.pak_files[0]?.version || '1.0.0');
        onNotification('success', `"${project.name}" kurulumu tamamlandı.`);
      }
    });
    const cleanError = window.api.onPakDownloadError((data) => {
      if (data.projectId === project.id) {
        cleanProgress();
        cleanComplete();
        cleanError();
        setPakStatus('error');
        setPakStatusMsg(data.message);
        onNotification('error', `İndirme hatası: ${data.message}`);
      }
    });

    await window.api.downloadPak(project.id, project.pak_files);
  };

  // ── İndirmeyi iptal et ───────────────────────────────────────────────────
  const handleCancelDownload = async () => {
    await window.api.cancelPakDownload(project.id);
    setPakStatus('not-installed');
    setPakProgress(0);
    setPakStatusMsg('');
  };

  // ── Projeyi başlat ───────────────────────────────────────────────────────
  const handleLaunch = async () => {
    if (!hasMapName) {
      onNotification('error', 'Bu projeye henüz bir sahne (map) tanımlanmamış.');
      return;
    }
    const result = await window.api.launchArchilya({
      mode: 'vr-project',
      mapName: project.map_name,
    });
    if (!result.success) {
      onNotification('error', result.message || 'Proje başlatılamadı.');
    }
  };

  const handleStartVr = async () => {
    if (!hasMapName) {
      onNotification('error', 'Bu projeye henüz bir sahne (map) tanımlanmamış.');
      return;
    }

    const result = await window.api.launchArchilya({
      mode: 'vr-project',
      mapName: project.map_name,
    });

    if (!result.success) {
      onNotification('error', result.message || 'VR ile başlatılamadı.');
    }
  };

  const handleWebShare = async () => {
    if (!hasMapName) {
      onNotification('error', 'Web ile paylaşım için map bilgisi zorunlu.');
      return;
    }

    if (!onStartWebShare) {
      onNotification('error', 'Web ile paylaşım servisi hazır değil.');
      return;
    }

    await onStartWebShare(project.map_name);
  };

  // ── Mimari dosya yükle ───────────────────────────────────────────────────
  const handleUpload = async () => {
    setUploading(true);
    setUploadPercent(0);

    const cleanProgress = window.api.onUploadProgress((data) => {
      if (data.projectId === project.id) setUploadPercent(data.percent);
    });
    const cleanComplete = window.api.onUploadComplete((data) => {
      if (data.projectId === project.id) onNotification('success', `${data.fileName} yüklendi.`);
    });
    const cleanError = window.api.onUploadError((data) => {
      if (data.projectId === project.id) onNotification('error', `${data.fileName}: ${data.error}`);
    });

    const result = await window.api.uploadFile(project.id);
    cleanProgress(); cleanComplete(); cleanError();
    setUploading(false);
    setUploadPercent(0);

    if (!result.success && !result.canceled) {
      onNotification('error', result.error || 'Yükleme başarısız.');
    } else if (result.success && result.count) {
      onNotification('success', `${result.count} dosya yüklendi.`);
    }
  };

  // ── Lokal klasor sync ───────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress(0);
    try {
      await window.api.syncProject(project.id);
      setSyncProgress(100);
      onNotification('success', `"${project.name}" senkronize edildi.`);
    } catch (err: any) {
      onNotification('error', `Senkronizasyon hatasi: ${err?.message || 'Bilinmeyen hata'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await window.api.openProjectFolder(project.id);
    } catch (err: any) {
      onNotification('error', `Klasor acilamadi: ${err?.message || 'Bilinmeyen hata'}`);
    }
  };

  // ── Proje sil ────────────────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    setDeleting(true);
    await onDelete(project.id, project.name);
    setDeleting(false);
    setShowConfirm(false);
  };

  // ── PAK Aksiyon Butonu ──────────────────────────────────────────────────
  const renderPakButton = () => {
    // PAK tanımlı değilse buton gösterme
    if (!hasPaks) return null;

    switch (pakStatus) {
      case 'checking':
        return (
          <button disabled className="pak-btn opacity-40 cursor-not-allowed">
            <Spinner /> KONTROL...
          </button>
        );

      case 'not-installed':
      case 'error':
        return (
          <button
            onClick={handleDownload}
            className="pak-btn bg-archilya-gold/10 border-archilya-gold/40 text-archilya-gold hover:bg-archilya-gold hover:text-black"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {pakStatus === 'error' ? 'TEKRAR İNDİR' : 'İNDİR'}
          </button>
        );

      case 'update-available':
        return (
          <button
            onClick={handleDownload}
            className="pak-btn bg-blue-500/10 border-blue-400/40 text-blue-400 hover:bg-blue-500 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            GÜNCELLE
          </button>
        );

      case 'downloading':
        return (
          <button
            onClick={handleCancelDownload}
            className="pak-btn bg-red-500/10 border-red-400/30 text-red-400 hover:bg-red-500 hover:text-white"
          >
            <Spinner cls="w-3 h-3" /> %{pakProgress} · İPTAL
          </button>
        );

      case 'installed':
        return (
          <button
            onClick={handleLaunch}
            disabled={!hasMapName}
            title={!hasMapName ? 'Sahne (map) tanımlanmamış' : `${project.map_name} sahnesini başlat`}
            className="pak-btn bg-emerald-500/10 border-emerald-400/40 text-emerald-400 hover:bg-emerald-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            BAŞLAT
          </button>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full bg-archilya-panel/40 border border-white/5 rounded overflow-hidden group hover:border-archilya-gold/20 transition-all duration-300">

      {/* ── Ana Satır ── */}
      <div className="flex flex-wrap items-center justify-between px-4 py-3 gap-3">

        {/* Sol: isim + meta */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
            <h3 className="font-display text-sm text-archilya-text uppercase tracking-wider truncate">
              {project.name}
            </h3>
          </div>
          <div className="flex items-center gap-3 mt-0.5 ml-3.5 flex-wrap">
            <span className={`text-[9px] font-mono tracking-widest ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <span className="text-[9px] text-archilya-text-dim/40 font-mono">
              {project.files?.length || 0} dosya · {formatBytes(project.totalSize || 0)}
            </span>
            {hasPaks && installedVer && (
              <span className="text-[9px] font-mono text-archilya-gold/30">
                PAK v{installedVer}
                {pakStatus === 'update-available' && latestVer && (
                  <span className="text-blue-400 ml-1">→ v{latestVer}</span>
                )}
              </span>
            )}
            {project.location && (
              <span className="text-[9px] text-archilya-text-dim/30 font-mono truncate max-w-[80px]">
                {project.location}
              </span>
            )}
          </div>
        </div>

        {/* Sağ: Aksiyonlar */}
         <div className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0">

          {/* PAK Aksiyon Butonu */}
          {renderPakButton()}

          {pakStatus === 'installed' && (
            <>
              <button
                onClick={handleLaunch}
                disabled={!hasMapName}
                className="pak-btn bg-emerald-500/10 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
              >
                BASLAT
              </button>

              <button
                onClick={handleStartVr}
                disabled={!hasMapName}
                className="pak-btn bg-indigo-500/10 border-indigo-400/40 text-indigo-300 hover:bg-indigo-500 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
              >
                VR ILE BASLAT
              </button>

              <button
                onClick={() => {
                  void handleWebShare();
                }}
                disabled={!hasMapName}
                className="pak-btn bg-cyan-500/10 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
              >
                WEB ILE PAYLAS
              </button>
            </>
          )}

          {/* Dosya Yükle */}
          <button
            onClick={handleUpload}
            disabled={uploading}
            title="Mimari Dosya Yükle"
            className="w-7 h-7 flex items-center justify-center border border-white/10 hover:border-archilya-gold/40 text-archilya-text-dim hover:text-archilya-gold rounded transition-all duration-200 disabled:opacity-40"
          >
            {uploading ? <Spinner /> : (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            )}
          </button>

          {/* Senkronize Et */}
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Proje dosyalarini senkronize et"
            className="w-7 h-7 flex items-center justify-center border border-white/10 hover:border-blue-400/40 text-archilya-text-dim hover:text-blue-400 rounded transition-all duration-200 disabled:opacity-40"
          >
            {syncing ? <Spinner /> : (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>
            )}
          </button>

          {/* Klasoru Ac */}
          <button
            onClick={handleOpenFolder}
            title="Proje klasorunu ac"
            className="w-7 h-7 flex items-center justify-center border border-white/10 hover:border-emerald-400/40 text-archilya-text-dim hover:text-emerald-400 rounded transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          </button>

          {/* Sil */}
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              title="Projeyi Çöp Kutusuna Gönder"
              className="w-7 h-7 flex items-center justify-center border border-white/10 hover:border-red-500/40 text-archilya-text-dim/50 hover:text-red-400 rounded transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="text-[9px] font-display tracking-wider px-2 py-1 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white rounded transition-all disabled:opacity-50"
              >
                {deleting ? '...' : 'SİL'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="text-[9px] font-display tracking-wider px-2 py-1 border border-white/10 text-archilya-text-dim hover:text-archilya-text rounded transition-all"
              >
                İPTAL
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PAK İndirme Progress ── */}
      {pakStatus === 'downloading' && (
        <div className="px-4 pb-2">
          <div className="w-full h-[1px] bg-white/5 overflow-hidden">
            <div
              className="h-full bg-archilya-gold transition-all duration-300"
              style={{ width: `${pakProgress}%` }}
            />
          </div>
          <p className="text-[9px] font-mono text-archilya-gold/50 mt-1 truncate">
            {pakStatusMsg || `%${pakProgress}`}
          </p>
        </div>
      )}

      {/* ── Mimari Dosya Yükleme Progress ── */}
      {uploading && (
        <div className="px-4 pb-2">
          <div className="w-full h-[1px] bg-white/5 overflow-hidden">
            <div
              className="h-full bg-blue-400/60 transition-all duration-300"
              style={{ width: `${uploadPercent}%` }}
            />
          </div>
          <p className="text-[9px] font-mono text-blue-400/50 mt-1 text-right">
            Yükleniyor... %{uploadPercent}
          </p>
        </div>
      )}

      {/* ── Senkronizasyon Progress ── */}
      {syncing && (
        <div className="px-4 pb-2">
          <div className="w-full h-[1px] bg-white/5 overflow-hidden">
            <div
              className="h-full bg-emerald-400/60 transition-all duration-300"
              style={{ width: `${syncProgress}%` }}
            />
          </div>
          <p className="text-[9px] font-mono text-emerald-400/60 mt-1 text-right">
            Senkronize ediliyor... %{syncProgress}
          </p>
        </div>
      )}

      {/* ── Dosya Listesi (genişletilmiş) ── */}
      {expanded && project.files && project.files.length > 0 && (
        <div className="border-t border-white/5 bg-black/20 px-4 py-2">
          <p className="text-[9px] text-archilya-gold/40 uppercase tracking-widest mb-2">MİMARİ DOSYALAR</p>
          <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
            {project.files.map((file: ProjectFile, i: number) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[9px] font-mono text-archilya-gold/40 uppercase w-8 flex-shrink-0">
                    {file.type || '?'}
                  </span>
                  <span className="text-[10px] font-mono text-archilya-text-dim truncate">
                    {file.name}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-archilya-text-dim/30 flex-shrink-0">
                  {formatBytes(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Genişlet/Daralt ── */}
      {project.files && project.files.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center py-1 border-t border-white/5 text-archilya-text-dim/20 hover:text-archilya-text-dim/50 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}
    </div>
  );
};
