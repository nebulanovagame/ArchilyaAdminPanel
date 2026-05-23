import React, { useState, useEffect } from 'react';
import type { VrProject, VrProjectStatus } from '../../shared/types';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

const Spinner = ({ cls = 'w-3 h-3' }: { cls?: string }) => (
  <svg className={`animate-spin ${cls}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

interface VrProjectCardProps {
  project:        VrProject;
  isGameRunning?: boolean;
  onNotification: (type: 'success' | 'error', message: string) => void;
  onStartWebShare?: (mapName: string) => Promise<void>;
}

export const VrProjectCard: React.FC<VrProjectCardProps> = ({ project, isGameRunning, onNotification, onStartWebShare }) => {
  const [status,      setStatus]      = useState<VrProjectStatus>('NOT_INSTALLED');
  const [progress,    setProgress]    = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [checking,    setChecking]    = useState(true);
  // Silme onayı için inline state — window.confirm() yerine
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const isBuiltInDemo = Boolean(project.isBuiltInDemo || project.isEmbedded);
  const isPublicDemo = Boolean(project.isPublicDemo && !isBuiltInDemo);
  const vrMapName = (project.vrMapName || project.map_name || '').trim();
  const webShareMapName = (project.webShareMapName || project.map_name || '').trim();

  const totalSize = project.files?.reduce((s, f) => s + (f.size || 0), 0) || 0;

  // Başlangıçta ve proje değişince durum kontrolü
  const refreshStatus = async () => {
    if (isBuiltInDemo) {
      setStatus('INSTALLED');
      setChecking(false);
      return;
    }

    setChecking(true);
    const st = await window.api.checkProjectStatus(project);
    setStatus(st);
    setChecking(false);
  };

  useEffect(() => {
    refreshStatus();
  }, [project.id, isBuiltInDemo]);

  // İndirme progress dinle
  useEffect(() => {
    const clean = window.api.onProjectProgress((data) => {
      if (data.projectId === project.id) {
        setProgress(data.progress);
        setProgressMsg(data.status);
      }
    });
    return clean;
  }, [project.id]);

  // İndir
  const handleDownload = async () => {
    if (isBuiltInDemo) {
      setStatus('INSTALLED');
      return;
    }

    setStatus('DOWNLOADING');
    setProgress(0);
    setProgressMsg('Başlatılıyor...');
    const result = await window.api.downloadProject(project);
    if (result.success) {
      setStatus('INSTALLED');
      setProgress(0);
      setProgressMsg('');
      onNotification('success', `"${project.title}" indirildi.`);
    } else {
      // İptal edilmişse sessizce NOT_INSTALLED'a dön, hata ise bildir
      if (result.message && !result.message.includes('iptal')) {
        onNotification('error', result.message || 'İndirme başarısız.');
      }
      setStatus('NOT_INSTALLED');
      setProgress(0);
      setProgressMsg('');
    }
  };

  // İptal
  const handleCancel = async () => {
    await window.api.cancelProjectDownload(project.id);
    setStatus('NOT_INSTALLED');
    setProgress(0);
    setProgressMsg('');
  };

  // Başlat
  const handleLaunch = async () => {
    if (!vrMapName) {
      onNotification('error', 'Bu projeye henüz sahne (map) tanımlanmamış.');
      return;
    }

    const result = await window.api.launchArchilya({
      mode: 'vr-project',
      mapName: vrMapName,
    });

    if (!result.success) {
      onNotification('error', result.message || 'Başlatılamadı.');
    }
  };

  const handleStartVr = async () => {
    await handleLaunch();
  };

  const handleWebShare = async () => {
    if (!webShareMapName) {
      onNotification('error', 'Web ile paylaşım için map bilgisi gerekli.');
      return;
    }

    if (!onStartWebShare) {
      onNotification('error', 'Web ile paylaşım servisi hazır değil.');
      return;
    }

    await onStartWebShare(webShareMapName);
  };

  // Silme onayını göster
  const handleDeleteClick = () => {
    setConfirmDelete(true);
  };

  // Silmeyi iptal et
  const handleDeleteCancel = () => {
    setConfirmDelete(false);
  };

  // Gerçek silme işlemi — window.confirm() YOK, inline onay kullanılıyor
  const handleDeleteConfirm = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    const result = await window.api.deleteProject_VR(project);
    setDeleting(false);
    if (result.success) {
      // Direkt state'i güncelle — confirm() race condition yok
      setStatus('NOT_INSTALLED');
      setProgress(0);
      setProgressMsg('');
      onNotification('success', `"${project.title}" silindi.`);
    } else {
      onNotification('error', result.message || 'Silinemedi.');
      // Silme başarısız → gerçek durumu yeniden kontrol et
      await refreshStatus();
    }
  };

  return (
    <div className="w-full bg-archilya-panel/40 border border-white/5 rounded overflow-hidden group hover:border-emerald-400/20 transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between px-4 py-3 gap-3">

        {/* Sol: İsim + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-emerald-400" />
            <h3 className="font-display text-sm text-archilya-text uppercase tracking-wider truncate">
              {project.title}
            </h3>
            {isBuiltInDemo && (
              <span className="px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-widest border border-archilya-gold/40 text-archilya-gold bg-archilya-gold/10">
                DEMO
              </span>
            )}
            {isPublicDemo && (
              <span className="px-1.5 py-0.5 text-[8px] font-mono uppercase tracking-widest border border-cyan-400/40 text-cyan-300 bg-cyan-500/10">
                PUBLIC DEMO
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-0.5 ml-3.5">
            <span className="text-[9px] text-emerald-400/60 font-mono tracking-widest uppercase">
              ARCHILYA PROJE
            </span>
            {vrMapName && (
              <span className="text-[9px] text-archilya-gold/40 font-mono">
                {vrMapName}
              </span>
            )}
            <span className="text-[9px] text-archilya-text-dim/40 font-mono">
              {isBuiltInDemo ? 'GOMULU MAP' : formatBytes(totalSize)}
            </span>
          </div>
        </div>

        {/* Sağ: Aksiyonlar */}
         <div className="flex flex-wrap items-center justify-end gap-1.5 flex-shrink-0">

          {/* Silme onayı (inline — confirm() yok) */}
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-red-400 font-mono">Emin misin?</span>
              <button
                onClick={handleDeleteConfirm}
                className="pak-btn bg-red-500/20 border-red-400/50 text-red-400 hover:bg-red-500 hover:text-white"
              >
                SİL
              </button>
              <button
                onClick={handleDeleteCancel}
                className="pak-btn bg-white/5 border-white/10 text-archilya-text-dim hover:bg-white/10"
              >
                İPTAL
              </button>
            </div>
          ) : deleting ? (
            <button disabled className="pak-btn opacity-40 cursor-not-allowed">
              <Spinner /> SİLİNİYOR
            </button>
          ) : checking ? (
            <button disabled className="pak-btn opacity-40 cursor-not-allowed">
              <Spinner /> KONTROL...
            </button>
          ) : status === 'NOT_INSTALLED' && !isBuiltInDemo ? (
            <button
              onClick={handleDownload}
              className="pak-btn bg-archilya-gold/10 border-archilya-gold/40 text-archilya-gold hover:bg-archilya-gold hover:text-black"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              İNDİR
            </button>
          ) : status === 'DOWNLOADING' && !isBuiltInDemo ? (
            <button
              onClick={handleCancel}
              className="pak-btn bg-red-500/10 border-red-400/30 text-red-400 hover:bg-red-500 hover:text-white"
            >
              <Spinner /> %{progress} · İPTAL
            </button>
          ) : (
            <>
              <button
                onClick={handleLaunch}
                disabled={isGameRunning}
                className="pak-btn bg-emerald-500/10 border-emerald-400/40 text-emerald-400 hover:bg-emerald-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                {isGameRunning ? 'ÇALIŞIYOR' : 'BAŞLAT'}
              </button>

              <button
                onClick={() => {
                  void handleStartVr();
                }}
                disabled={isGameRunning}
                className="pak-btn bg-indigo-500/10 border-indigo-400/40 text-indigo-300 hover:bg-indigo-500 hover:text-black disabled:opacity-30 disabled:cursor-not-allowed"
              >
                VR ILE BASLAT
              </button>

              <button
                onClick={() => {
                  void handleWebShare();
                }}
                className="pak-btn bg-cyan-500/10 border-cyan-400/40 text-cyan-300 hover:bg-cyan-500 hover:text-black"
              >
                WEB ILE PAYLAS
              </button>

              {!isBuiltInDemo && (
                <button
                  onClick={handleDeleteClick}
                  title="Yerel dosyaları sil"
                  className="w-7 h-7 flex items-center justify-center border border-white/10 hover:border-red-500/40 text-archilya-text-dim/50 hover:text-red-400 rounded transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {status === 'DOWNLOADING' && (
        <div className="px-4 pb-2">
          <div className="w-full h-[1px] bg-white/5 overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[9px] font-mono text-emerald-400/50 mt-1 truncate">
            {progressMsg || `%${progress}`}
          </p>
        </div>
      )}
    </div>
  );
};
