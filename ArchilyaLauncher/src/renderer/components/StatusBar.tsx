import React from 'react';

interface StatusBarProps {
  syncStatus?: string;
  credits?: number;
  version?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  syncStatus = 'Senkronize',
  credits = 840,
  version = 'v2.0.0',
}) => {
  return (
    <footer className="h-5 flex items-center justify-between px-5 bg-transparent border-t border-white/[0.05] text-[10px] font-mono tracking-wider uppercase select-none">
      {/* Sol: Senkronizasyon — çok soluk */}
      <div className="flex items-center gap-1.5 text-archilya-text-dim/50">
        <span className="w-1 h-1 rounded-full bg-emerald-400/70" />
        <span>{syncStatus}</span>
      </div>

      {/* Sağ: Kredi + Versiyon — neredeyse görünmez */}
      <div className="flex items-center gap-3 text-archilya-text-dim/45">
        <span className="flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-archilya-gold/30"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <span className="text-archilya-gold/30">{credits}</span>
        </span>
        <span className="text-archilya-text-dim/10">|</span>
        <span>{version}</span>
      </div>
    </footer>
  );
};
