import React, { useState, useRef, useEffect } from 'react';

interface AIMagicRenameProps {
  currentName: string;
  suggestedName: string;
  onAccept: () => void;
  onReject: () => void;
  isVisible: boolean;
}

export const AIMagicRename: React.FC<AIMagicRenameProps> = ({
  currentName: _currentName,
  suggestedName,
  onAccept,
  onReject,
  isVisible,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isVisible) return null;

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-5 h-5 flex items-center justify-center rounded-full bg-archilya-gold/10 border border-archilya-gold/20 hover:bg-archilya-gold/20 transition-all duration-200 cursor-pointer animate-pulse shadow-[0_0_8px_rgba(212,175,55,0.3)]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="text-archilya-gold"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-64">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#121212] border-t border-l border-archilya-gold/20 rotate-45" />
          <div className="bg-[#121212] border border-archilya-gold/20 rounded-lg shadow-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 text-archilya-gold"
              >
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <circle cx="8" cy="16" r="1" />
                <circle cx="16" cy="16" r="1" />
              </svg>
              <span className="text-[10px] font-mono tracking-wider text-archilya-gold uppercase">
                AI Yeniden Adlandır
              </span>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded p-3 mb-4">
              <div className="text-[9px] font-mono text-archilya-text-dim/40 uppercase mb-1">AI Önerisi</div>
              <div className="text-[12px] font-mono text-archilya-text break-all">{suggestedName}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onAccept(); setIsOpen(false); }}
                className="flex-1 h-8 rounded bg-archilya-gold/10 border border-archilya-gold/40 text-archilya-gold hover:bg-archilya-gold hover:text-black transition-all duration-200 text-[10px] font-mono tracking-wider uppercase"
              >
                Kabul Et
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(); setIsOpen(false); }}
                className="flex-1 h-8 rounded bg-transparent border border-white/[0.08] text-archilya-text-dim/60 hover:text-archilya-text hover:border-white/[0.15] transition-all duration-200 text-[10px] font-mono tracking-wider uppercase"
              >
                Reddet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};