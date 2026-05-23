import React from 'react';
import type { WebShareStatus } from '../../shared/streamingTypes';
import { PublicUrlBox } from './PublicUrlBox';

interface StreamingStatusCardProps {
  status: WebShareStatus;
  loading: boolean;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
  onCopyUrl: () => Promise<void>;
}

const STATE_LABELS: Record<WebShareStatus['state'], string> = {
  idle: 'KAPALI',
  starting: 'BASLATILIYOR',
  running: 'YAYIN AKTIF',
  stopping: 'DURDURULUYOR',
  error: 'HATA',
};

const CONNECTIVITY_LABELS: Record<NonNullable<WebShareStatus['connectivityLevel']>, string> = {
  checking: 'AG KONTROLU',
  ready: 'INTERNET HAZIR',
  warning: 'SINIRLI HAZIR',
  blocked: 'TURN GEREKLI',
};

export const StreamingStatusCard: React.FC<StreamingStatusCardProps> = ({
  status,
  loading,
  error,
  onStart,
  onStop,
  onCopyUrl,
}) => {
  const canStart = !loading && (status.state === 'idle' || status.state === 'error');
  const canStop = !loading && (status.state === 'running' || status.state === 'starting');
  const diagnostics: string[] = [];
  const connectivityTone =
    status.connectivityLevel === 'ready'
      ? 'text-emerald-300/80'
      : status.connectivityLevel === 'warning'
        ? 'text-amber-300/80'
        : status.connectivityLevel === 'blocked'
          ? 'text-red-300/80'
          : 'text-cyan-200/70';

  if (status.provider) {
    diagnostics.push(`Provider: ${status.provider}`);
  }

  if (status.turnMode) {
    diagnostics.push(`TURN: ${status.turnMode === 'managed' ? 'managed' : status.turnMode === 'local' ? 'local' : status.turnMode === 'shared-relay' ? 'shared relay' : 'yok'}`);
  }

  if (status.sessionId) {
    diagnostics.push(`Session: ${status.sessionId}`);
  }

  if (status.lastStartedAtIso) {
    diagnostics.push(`Son baslangic: ${new Date(status.lastStartedAtIso).toLocaleTimeString('tr-TR')}`);
  }

  if (status.lastStoppedAtIso) {
    diagnostics.push(`Son durus: ${new Date(status.lastStoppedAtIso).toLocaleTimeString('tr-TR')}`);
  }

  return (
    <div className="control-card w-full rounded border-cyan-400/20 bg-[#0b1418]/80 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-cyan-300/80">Web ile Paylas</p>
          <p className="mt-1 font-display text-sm tracking-wider text-cyan-100">{STATE_LABELS[status.state]}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onStart}
            disabled={!canStart}
            className="px-3 py-2 text-[10px] tracking-widest uppercase border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Yayini Baslat
          </button>
          <button
            onClick={onStop}
            disabled={!canStop}
            className="px-3 py-2 text-[10px] tracking-widest uppercase border border-red-400/30 text-red-300 hover:bg-red-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Yayini Durdur
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-archilya-text-dim">{status.message || 'Durum bekleniyor...'}</p>
      {status.connectivityLevel && (
        <p className={`mt-1 text-[10px] font-mono uppercase ${connectivityTone}`}>
          {CONNECTIVITY_LABELS[status.connectivityLevel]}
          {status.internetReachable ? ' · musteri sadece link ile baglanir' : ''}
        </p>
      )}
      {status.connectivityMessage && (
        <p className="mt-1 text-[10px] text-archilya-text-dim/80">{status.connectivityMessage}</p>
      )}
      {diagnostics.length > 0 && (
        <p className="mt-1 text-[10px] font-mono text-cyan-200/70">
          {diagnostics.join(' · ')}
        </p>
      )}
      {status.lastError && status.state !== 'running' && (
        <p className="mt-1 text-[10px] font-mono text-amber-300/80">Son hata: {status.lastError}</p>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <div className="mt-3">
        <PublicUrlBox
          publicUrl={status.publicUrl}
          fallbackUrl={status.lastSuccessfulUrl}
          onCopy={onCopyUrl}
          disabled={loading}
        />
      </div>
    </div>
  );
};
