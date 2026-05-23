import React from 'react';
import type { MachineIdentityInfo } from '../../shared/remoteCommandTypes';

interface MachineIdentityCardProps {
  identity: MachineIdentityInfo | null;
  onCopy: () => Promise<void>;
}

export const MachineIdentityCard: React.FC<MachineIdentityCardProps> = ({ identity, onCopy }) => {
  if (!identity) {
    return (
      <div className="control-card rounded p-4">
        <p className="text-[10px] tracking-[0.2em] uppercase text-archilya-gold/70">Cihaz Kimligi</p>
        <p className="mt-2 text-xs text-archilya-text-dim">Yukleniyor...</p>
      </div>
    );
  }

  return (
    <div className="control-card rounded p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-archilya-gold/70">Cihaz Kimligi</p>
          <p className="mt-1 font-mono text-xs text-archilya-text break-all">{identity.machineId}</p>
        </div>
        <button
          onClick={() => {
            void onCopy();
          }}
          className="px-3 py-1.5 text-[10px] tracking-widest uppercase border border-archilya-gold/40 text-archilya-gold hover:bg-archilya-gold hover:text-black transition-colors"
        >
          Kopyala
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-mono text-archilya-text-dim/70">
        <span className="truncate">host: {identity.hostname}</span>
        <span className="truncate">platform: {identity.platform}</span>
        <span className="truncate">arch: {identity.arch}</span>
      </div>
    </div>
  );
};
