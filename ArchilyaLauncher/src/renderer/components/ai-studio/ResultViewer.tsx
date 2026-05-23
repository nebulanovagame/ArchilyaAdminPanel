import React, { useCallback, useState, useRef, useEffect } from 'react';

interface ResultViewerProps {
  imageUrl: string;
  onDownload: () => void;
  onSaveToFolder?: () => void;
  sourceImage?: string;
  onRetry?: () => void;
  onVariation?: () => void;
  onUseAsSource?: () => void;
  onFeedback?: (type: 'positive' | 'negative') => void;
  feedback?: 'positive' | 'negative' | null;
}

export const ResultViewer: React.FC<ResultViewerProps> = ({
  imageUrl,
  onDownload,
  onSaveToFolder,
  sourceImage,
  onRetry,
  onVariation,
  onUseAsSource,
  onFeedback,
  feedback,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const btnBase = 'px-3 py-1.5 rounded border text-[10px] font-display tracking-widest uppercase transition-all duration-200';
  const btnPrimary = `${btnBase} border-archilya-gold/30 bg-archilya-gold/[0.08] text-archilya-gold hover:border-archilya-gold/50`;
  const btnSecondary = `${btnBase} border-white/[0.08] bg-black/60 text-archilya-text-dim/80 hover:text-archilya-gold`;

  return (
    <div
      className={`
        relative group overflow-hidden rounded-xl border border-white/[0.06]
        bg-white/[0.02] transition-all duration-300
        ${isFullscreen ? 'fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 rounded-none border-none' : ''}
      `}
    >
      {/* Image area */}
      <div className={`relative w-full ${isFullscreen ? 'flex-1 flex items-center justify-center' : ''}`}>
        {sourceImage ? (
          /* Before/After split slider */
          <div
            ref={containerRef}
            className={`relative select-none overflow-hidden cursor-col-resize ${isFullscreen ? 'max-h-[80vh] max-w-[90vw]' : 'rounded-xl'}`}
            onMouseDown={handleMouseDown}
          >
            {/* Source image (before) — bottom layer */}
            <img
              src={sourceImage}
              alt="Kaynak"
              draggable={false}
              className="w-full h-auto block"
            />
            {/* Result image (after) — top layer, clipped from left */}
            <img
              src={imageUrl}
              alt="AI Render Sonucu"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
            />
            {/* Divider line */}
            <div
              className="absolute top-0 bottom-0 w-[2px] bg-white/80 pointer-events-none"
              style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
            >
              {/* Handle circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center pointer-events-none">
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
                  className="text-gray-700"
                >
                  <path d="M8 3l-5 9 5 9" />
                  <path d="M16 3l5 9-5 9" />
                </svg>
              </div>
            </div>
            {/* Labels */}
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-display tracking-widest uppercase text-white/70 pointer-events-none">
              Önce
            </span>
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-display tracking-widest uppercase text-white/70 pointer-events-none">
              Sonra
            </span>
          </div>
        ) : (
          /* Single result image */
          <img
            src={imageUrl}
            alt="AI Render Sonucu"
            className={`
              object-contain transition-transform duration-500
              ${isFullscreen ? 'max-h-[80vh] max-w-[90vw]' : 'w-full h-auto rounded-xl'}
            `}
          />
        )}

        {/* Fullscreen toggle — overlay */}
        <button
          onClick={toggleFullscreen}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded border border-white/[0.08] bg-black/60 backdrop-blur-sm
            text-archilya-text-dim/80 hover:text-archilya-gold hover:border-archilya-gold/30 transition-all duration-200
            ${isFullscreen ? 'absolute top-4 right-4' : 'absolute top-3 right-3 opacity-0 group-hover:opacity-100'}
          `}
          title={isFullscreen ? 'Kapat' : 'Tam Ekran'}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14h6v6" />
              <path d="M20 10h-6V4" />
              <path d="M14 10l7-7" />
              <path d="M10 14l-7 7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
          )}
          <span className="text-[10px] font-display tracking-widest uppercase">
            {isFullscreen ? 'Kapat' : 'Tam Ekran'}
          </span>
        </button>
      </div>

      {/* Action buttons row */}
      <div className={`
        flex flex-wrap items-center gap-2
        ${isFullscreen ? 'px-6 py-4 justify-center' : 'px-3 py-3'}
      `}>
        {onRetry && (
          <button onClick={onRetry} className={btnPrimary} title="Yeniden Dene">
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Yeniden Dene
            </span>
          </button>
        )}
        {onVariation && (
          <button onClick={onVariation} className={btnPrimary} title="Varyasyon">
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="6" height="6" rx="1" />
                <rect x="16" y="2" width="6" height="6" rx="1" />
                <rect x="9" y="13" width="6" height="6" rx="1" />
                <path d="M5 8v3a2 2 0 0 0 2 2h1" />
                <path d="M19 8v3a2 2 0 0 1-2 2h-1" />
              </svg>
              Varyasyon
            </span>
          </button>
        )}
        {onUseAsSource && (
          <button onClick={onUseAsSource} className={btnPrimary} title="Kaynak Olarak Kullan">
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              Kaynak Olarak Kullan
            </span>
          </button>
        )}
        <button onClick={onDownload} className={btnSecondary} title="İndir">
          <span className="flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            İndir
          </span>
        </button>
        {onSaveToFolder && (
          <button onClick={onSaveToFolder} className={btnSecondary} title="Çıktıyı 05_Musteri_Sunumlari Klasörüne Kaydet">
            <span className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                <line x1="12" y1="11" x2="12" y2="17" />
                <line x1="9" y1="14" x2="15" y2="14" />
              </svg>
              Sunum Klasörüne Kaydet
            </span>
          </button>
        )}
      </div>

      {/* Feedback row */}
      {onFeedback && (
        <div className={`
          flex items-center justify-center gap-2 border-t border-white/[0.04]
          ${isFullscreen ? 'px-6 py-3' : 'px-3 py-2'}
        `}>
          <span className="text-[9px] font-mono text-archilya-text-dim/30 uppercase tracking-wider mr-1">Geri Bildirim</span>
          <button
            onClick={() => onFeedback('positive')}
            className={`p-1.5 rounded border transition-all ${
              feedback === 'positive'
                ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400'
                : 'border-white/[0.06] bg-white/[0.02] text-archilya-text-dim/30 hover:text-emerald-400'
            }`}
            title="Beğendim"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
          </button>
          <button
            onClick={() => onFeedback('negative')}
            className={`p-1.5 rounded border transition-all ${
              feedback === 'negative'
                ? 'border-red-500/30 bg-red-500/[0.08] text-red-400'
                : 'border-white/[0.06] bg-white/[0.02] text-archilya-text-dim/30 hover:text-red-400'
            }`}
            title="Beğenmedim"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
          </button>
        </div>
      )}
    </div>
  );
};
