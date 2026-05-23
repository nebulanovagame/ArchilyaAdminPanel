import React from 'react';
import type { RemoteCommandHistoryEntry } from '../../shared/remoteCommandTypes';

interface CommandHistoryPanelProps {
  entries: RemoteCommandHistoryEntry[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}

const STATUS_STYLE: Record<RemoteCommandHistoryEntry['status'], string> = {
  pending: 'text-amber-300 border-amber-400/30 bg-amber-500/10',
  processing: 'text-blue-300 border-blue-400/30 bg-blue-500/10',
  completed: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10',
  failed: 'text-red-300 border-red-400/30 bg-red-500/10',
  ignored: 'text-zinc-300 border-white/20 bg-white/5',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const CommandHistoryPanel: React.FC<CommandHistoryPanelProps> = ({ entries, loading, onRefresh }) => {
  return (
    <div className="control-card rounded p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] tracking-[0.2em] uppercase text-archilya-gold/70">Komut Gecmisi</p>
        <button
          onClick={() => {
            void onRefresh();
          }}
          className="px-2.5 py-1 text-[10px] tracking-widest uppercase border border-white/15 text-archilya-text-dim hover:text-archilya-text hover:border-white/30 transition-colors"
        >
          Yenile
        </button>
      </div>

      <div className="mt-3 max-h-44 overflow-y-auto pr-1 custom-scrollbar space-y-2">
        {entries.length === 0 ? (
          <p className="text-xs text-archilya-text-dim">Henüz uzaktan komut kaydı yok.</p>
        ) : (
          entries.map((entry) => (
            <div key={`${entry.commandId}-${entry.timestampIso}`} className="rounded border border-white/10 bg-black/30 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-archilya-text">{entry.command}</span>
                <span className="font-mono text-[10px] text-archilya-text-dim">{formatTime(entry.timestampIso)}</span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 border ${STATUS_STYLE[entry.status]}`}>
                  {entry.status}
                </span>
                {entry.resultUrl && (
                  <span className="text-[10px] text-cyan-300 truncate max-w-[180px]">{entry.resultUrl}</span>
                )}
              </div>

              <p className="mt-2 text-[11px] text-archilya-text-dim leading-relaxed">{entry.message}</p>
            </div>
          ))
        )}
      </div>

      {loading && <p className="mt-2 text-[10px] text-archilya-text-dim/70">Kayitlar guncelleniyor...</p>}
    </div>
  );
};
