import React from 'react';
import { NotificationBell } from './NotificationBell';

export const TitleBar: React.FC = () => {
  return (
    <div className="h-10 w-full flex justify-end items-center select-none z-50 px-2" style={{ WebkitAppRegion: 'drag' } as any}>
      {/* Sağ: Kontrol Butonları */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <NotificationBell />
        <button
          onClick={() => window.api.minimize()}
          className="w-10 h-8 flex items-center justify-center text-archilya-text/60 hover:text-archilya-gold/70 hover:bg-white/[0.03] transition-all duration-300 group"
        >
          <div className="w-3 h-[1px] bg-current group-hover:w-4 transition-all"></div>
        </button>
        
        <button 
          onClick={() => window.api.close()} 
          className="w-10 h-8 flex items-center justify-center text-archilya-text/60 hover:text-red-400 hover:bg-red-400/5 transition-all duration-300 group"
        >
          <div className="relative w-3 h-3 flex items-center justify-center">
            <div className="absolute w-full h-[1px] bg-current rotate-45 group-hover:rotate-90 transition-transform"></div>
            <div className="absolute w-full h-[1px] bg-current -rotate-45 group-hover:-rotate-90 transition-transform"></div>
          </div>
        </button>
      </div>
    </div>
  );
};
