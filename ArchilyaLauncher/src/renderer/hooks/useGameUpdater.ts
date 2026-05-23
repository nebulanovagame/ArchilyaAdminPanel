import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameManifest, GameUpdateCheckResult } from '../../shared/types';

export type GameStatus = 
  | 'initializing'
  | 'checking' 
  | 'offline-ready'
  | 'not-installed' 
  | 'update-available' 
  | 'ready' 
  | 'downloading' 
  | 'verifying' 
  | 'extracting' 
  | 'maintenance' 
  | 'error'
  | 'playing';

interface UseGameUpdaterReturn {
  status: GameStatus;
  progress: number;
  statusMessage: string;
  manifest: GameManifest | null;
  localVersion: string | null;
  checkForUpdates: () => void;
  startGameUpdate: () => void;
  launchGame: (options?: { allowOutdated?: boolean }) => void;
}

export const useGameUpdater = (): UseGameUpdaterReturn => {
  const [status, setStatus] = useState<GameStatus>('initializing');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Başlatılıyor...');
  const [manifest, setManifest] = useState<GameManifest | null>(null);
  const [localVersion, setLocalVersion] = useState<string | null>(null);

  // Anlık statüyü tutan Ref
  const statusRef = useRef<GameStatus>('initializing');
  const launchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const checkForUpdates = useCallback(async () => {
    setStatus('checking');
    setStatusMessage('Güncellemeler kontrol ediliyor...');
    
    try {
      const result: GameUpdateCheckResult = await window.api.checkGameUpdate();
      
      console.log('Update Check Result:', result);

      if (result.localVersion) {
        setLocalVersion(result.localVersion);
      }
      
      if (result.remoteManifest) {
        setManifest(result.remoteManifest);
      }

      switch (result.status) {
        case 'maintenance':
          setStatus('maintenance');
          setStatusMessage(result.message || 'Bakım modu aktif.');
          break;
        case 'offline-ready':
          setStatus('offline-ready');
          setStatusMessage('Çevrimdışı Mod (İnternet Yok)');
          break;
        case 'not-installed':
          setStatus('not-installed');
          setStatusMessage('Archilya yüklü değil.');
          break;
        case 'update-available':
          setStatus('update-available');
          setStatusMessage(`Yeni güncelleme mevcut: v${result.remoteManifest?.version}`);
          break;
        case 'ready':
          setStatus('ready');
          setStatusMessage('Archilya güncel ve başlatmaya hazır.');
          break;
        case 'error':
          setStatus('error');
          setStatusMessage(result.message || 'Bilinmeyen bir hata oluştu.');
          break;
      }
    } catch (err: any) {
      setStatus('error');
      setStatusMessage('Bağlantı hatası: ' + err.message);
    }
  }, []);

  const startGameUpdate = useCallback(() => {
    if (!manifest) return;
    
    setStatus('downloading');
    setProgress(0);
    setStatusMessage('İndirme başlatılıyor...');
    
    window.api.startGameUpdate(manifest);
  }, [manifest]);

  const launchGame = useCallback(async (options?: { allowOutdated?: boolean }) => {
    if (status === 'update-available' && !options?.allowOutdated) {
      setStatusMessage('Yeni güncelleme mevcut. Baslatmadan once guncelleme onerilir.');
      return;
    }

    setStatus('playing'); // UI'da butonları disable etmek için
    const result = await window.api.launchGame();
    
    if (!result.success) {
      setStatus('error');
      setStatusMessage('Archilya başlatılamadı: ' + result.message);
    } else {
      // Archilya kapandıktan sonra tekrar ready'e dönmek için bir listener eklenebilir
      // veya basitçe timeout ile:
      if (launchTimeoutRef.current) clearTimeout(launchTimeoutRef.current);
      launchTimeoutRef.current = setTimeout(() => {
          setStatus('ready');
      }, 5000);
    }
  }, [status]);

  // Event Listeners - Sadece manifest değişince listenerları güncelle
  useEffect(() => {
    // Progress Listener
    const removeProgressListener = window.api.onGameUpdateProgress((data) => {
      // data: { step: 'downloading'|'verifying'|'extracting', progress: number, status: string }
      if (data.step === 'downloading') setStatus('downloading');
      else if (data.step === 'verifying') setStatus('verifying');
      else if (data.step === 'extracting') setStatus('extracting');
      
      setProgress(data.progress);
      setStatusMessage(data.status);
    });

    // Complete Listener
    const removeCompleteListener = window.api.onGameUpdateComplete((data) => {
      if (data.success) {
        setStatus('ready');
        setStatusMessage('Kurulum tamamlandı! Archilya hazır.');
        // Versiyonu güncelle
        if (manifest) setLocalVersion(manifest.version);
      }
    });

    // Error Listener
    const removeErrorListener = window.api.onGameUpdateError((data) => {
      setStatus('error');
      setStatusMessage(data.message);
    });

    // Background Update Watcher Listener
    const removeUpdateAvailableListener = window.api.onGameUpdateAvailable((newManifest) => {
      // Sadece Archilya çalışmıyorsa veya indirme/çıkarma yapılmıyorsa güncelleme durumuna geç
      const currentStatus = statusRef.current;
      if (
        currentStatus !== 'playing' && 
        currentStatus !== 'downloading' && 
        currentStatus !== 'extracting' && 
        currentStatus !== 'verifying'
      ) {
        setManifest(newManifest);
        setStatus('update-available');
        setStatusMessage(`Yeni güncelleme mevcut: v${newManifest.version}`);
      }
    });

    // Global Archilya Durum Dinleyicisi
    const removeGameStatusListener = window.api.onGameStatusChanged((isRunning: boolean) => {
      if (isRunning) {
        setStatus('playing');
        setStatusMessage('Archilya çalışıyor...');
      } else {
        // Archilya kapandığında tekrar kontrol et
        checkForUpdates();
      }
    });

    return () => {
      removeProgressListener();
      removeCompleteListener();
      removeErrorListener();
      removeUpdateAvailableListener();
      removeGameStatusListener();
    };
  }, [manifest, checkForUpdates]); // status dependency'sini kaldırdık

  // Initial Check - Sadece ilk renderda çalışsın
  useEffect(() => {
    checkForUpdates();
  }, [checkForUpdates]);

  useEffect(() => {
    return () => {
      if (launchTimeoutRef.current) clearTimeout(launchTimeoutRef.current);
    };
  }, []);

  return {
    status,
    progress,
    statusMessage,
    manifest,
    localVersion,
    checkForUpdates,
    startGameUpdate,
    launchGame
  };
};
