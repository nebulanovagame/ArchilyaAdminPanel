import React from 'react';

interface PublicUrlBoxProps {
  publicUrl: string | null;
  fallbackUrl?: string;
  onCopy: () => Promise<void>;
  disabled?: boolean;
}

export const PublicUrlBox: React.FC<PublicUrlBoxProps> = ({ publicUrl, fallbackUrl, onCopy, disabled = false }) => {
  const visibleUrl = publicUrl || fallbackUrl || null;

  return (
    <div className="rounded border border-cyan-400/20 bg-cyan-500/5 p-3">
      <p className="text-[10px] tracking-widest uppercase text-cyan-300/80">Paylasim Linki</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex-1 truncate rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-cyan-100/90">
          {visibleUrl || 'Henuz olusturulmadi'}
        </div>
        <button
          onClick={() => {
            void onCopy();
          }}
          disabled={!visibleUrl || disabled}
          className="px-3 py-1.5 text-[10px] tracking-widest uppercase border border-cyan-400/30 text-cyan-300 hover:bg-cyan-500 hover:text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Kopyala
        </button>
      </div>
    </div>
  );
};
