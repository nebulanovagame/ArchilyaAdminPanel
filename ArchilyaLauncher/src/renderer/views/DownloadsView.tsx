import React from 'react';

export const DownloadsView: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-8">
      <h1 className="font-display text-xl tracking-[0.18em] text-archilya-text uppercase mb-8">İndirme Yöneticisi</h1>

      {/* Devam Eden */}
      <div className="mb-8">
        <p className="text-[9px] font-mono uppercase tracking-widest text-archilya-gold/30 mb-4">Devam Eden</p>
        <div className="space-y-4">
          <div className="rounded-lg p-4 bg-white/[0.01] border border-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-archilya-text/70 font-medium">Rapor_v2.pdf</span>
              <span className="text-[9px] font-mono text-archilya-text-dim/30">45 MB / 120 MB</span>
            </div>
            <div className="w-full h-[2px] bg-white/[0.03] overflow-hidden rounded-full">
              <div className="h-full bg-archilya-gold/40 rounded-full transition-all" style={{ width: '37%' }} />
            </div>
          </div>
          <div className="rounded-lg p-4 bg-white/[0.01] border border-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] text-archilya-text/70 font-medium">Tasarim.dwg</span>
              <span className="text-[9px] font-mono text-archilya-text-dim/30">12 MB / 80 MB</span>
            </div>
            <div className="w-full h-[2px] bg-white/[0.03] overflow-hidden rounded-full">
              <div className="h-full bg-archilya-gold/25 rounded-full transition-all" style={{ width: '15%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tamamlanan */}
      <div>
        <p className="text-[9px] font-mono uppercase tracking-widest text-emerald-400/30 mb-4">Tamamlanan (Bugün)</p>
        <div className="space-y-2">
          {[
            { name: 'Plan_A1.pdf', size: '8 MB', time: '14:30' },
            { name: 'Texture_01.png', size: '24 MB', time: '14:28' },
            { name: 'Level_02.umap', size: '156 MB', time: '14:15' },
          ].map((item) => (
            <div key={item.name} className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-white/[0.02] bg-white/[0.01]">
              <div className="flex items-center gap-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400/40"><polyline points="20 6 9 17 4 12"/></svg>
                <span className="text-[11px] text-archilya-text-dim/60">{item.name}</span>
              </div>
              <span className="text-[9px] font-mono text-archilya-text-dim/20">{item.time} — {item.size}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
