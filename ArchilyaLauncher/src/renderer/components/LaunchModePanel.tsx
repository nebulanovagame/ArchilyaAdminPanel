import React from 'react';
import type { GameStatus } from '../hooks/useGameUpdater';

interface LaunchModePanelProps {
  gameStatus: GameStatus;
  progress: number;
  onPrimaryAction: () => void;
  onVrAction: () => void;
  onStartWebShare: () => void;
  onStopWebShare: () => void;
  isWebShareActive: boolean;
  webShareLoading: boolean;
}

function getPrimaryLabel(status: GameStatus, progress: number): string {
  switch (status) {
    case 'initializing':
    case 'checking':
      return 'KONTROL';
    case 'not-installed':
      return 'KURULUM';
    case 'update-available':
      return 'GUNCELLE';
    case 'downloading':
      return `%${progress}`;
    case 'verifying':
      return 'DOGRULAMA';
    case 'extracting':
      return 'KURULUYOR';
    case 'ready':
    case 'offline-ready':
      return 'BASLAT';
    case 'playing':
      return 'CALISIYOR';
    case 'maintenance':
      return 'BAKIM';
    case 'error':
      return 'TEKRAR';
    default:
      return 'BEKLE';
  }
}

export const LaunchModePanel: React.FC<LaunchModePanelProps> = ({
  gameStatus,
  progress,
  onPrimaryAction,
  onVrAction,
  onStartWebShare,
  onStopWebShare,
  isWebShareActive,
  webShareLoading,
}) => {
  const primaryDisabled =
    gameStatus === 'initializing' ||
    gameStatus === 'checking' ||
    gameStatus === 'downloading' ||
    gameStatus === 'verifying' ||
    gameStatus === 'extracting' ||
    gameStatus === 'maintenance';

  return (
    <div className="control-card w-full rounded p-4">
      <p className="text-[10px] tracking-[0.2em] uppercase text-archilya-gold/70">Baslatma Modlari</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          onClick={onPrimaryAction}
          disabled={primaryDisabled}
          className="h-10 border border-archilya-gold/30 text-archilya-gold text-xs tracking-widest uppercase hover:bg-archilya-gold hover:text-black disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          {getPrimaryLabel(gameStatus, progress)}
        </button>

        <button
          onClick={onVrAction}
          disabled={primaryDisabled || gameStatus === 'not-installed'}
          className="h-10 border border-emerald-400/30 text-emerald-300 text-xs tracking-widest uppercase hover:bg-emerald-500 hover:text-black disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          VR ile Baslat
        </button>

        <button
          onClick={isWebShareActive ? onStopWebShare : onStartWebShare}
          disabled={webShareLoading}
          className="h-10 border border-cyan-400/30 text-cyan-300 text-xs tracking-widest uppercase hover:bg-cyan-500 hover:text-black disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
        >
          {isWebShareActive ? 'Yayini Durdur' : 'Web ile Paylas'}
        </button>
      </div>
    </div>
  );
};
