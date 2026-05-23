import React, { useState } from 'react';
import type { AiGenerationRecord } from '../../types/ai-gallery';

interface AiGalleryDetailProps {
  record: AiGenerationRecord;
  onClose: () => void;
  onFeedback: (type: 'positive' | 'negative') => void;
  onDelete: () => void;
}

export const AiGalleryDetail: React.FC<AiGalleryDetailProps> = ({
  record,
  onClose,
  onFeedback,
  onDelete,
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const dateStr = new Date(record.createdAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0f1115] border border-white/[0.06] rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
          <div>
            <h2 className="text-sm font-display text-archilya-text">{record.toolName}</h2>
            <p className="text-[10px] text-archilya-text-dim/40 mt-0.5">{dateStr} · {record.creditsCost} Kredi</p>
          </div>
          <div className="flex items-center gap-2">
            {record.projectName && (
              <span className="text-[10px] font-mono text-archilya-gold/50 px-2 py-1 rounded bg-archilya-gold/[0.06] border border-archilya-gold/10">
                {record.projectName}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded text-archilya-text-dim/40 hover:text-archilya-text hover:bg-white/[0.04] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Image area */}
        <div className="flex-1 overflow-auto p-6">
          {record.sourceImage ? (
            <div
              className="relative select-none overflow-hidden cursor-col-resize rounded-xl"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseUp}
            >
              <img src={record.sourceImage} alt="Kaynak" className="w-full h-auto block" draggable={false} />
              <img
                src={record.imageUrl}
                alt="Sonuç"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
                draggable={false}
              />
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-white/80 pointer-events-none"
                style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700"><path d="M8 3l-5 9 5 9"/><path d="M16 3l5 9-5 9"/></svg>
                </div>
              </div>
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-display tracking-widest uppercase text-white/70 pointer-events-none">Önce</span>
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/60 text-[10px] font-display tracking-widest uppercase text-white/70 pointer-events-none">Sonra</span>
            </div>
          ) : (
            <img src={record.imageUrl} alt="Sonuç" className="w-full h-auto rounded-xl" />
          )}

          {/* Prompt */}
          <div className="mt-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <p className="text-[10px] font-mono text-archilya-text-dim/30 uppercase tracking-wider mb-1">Prompt</p>
            <p className="text-[12px] text-archilya-text-dim/70 leading-relaxed">{record.promptText || 'Prompt belirtilmemiş'}</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onFeedback('positive')}
              className={`p-2 rounded border transition-all ${record.feedback === 'positive' ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400' : 'border-white/[0.06] bg-white/[0.02] text-archilya-text-dim/40 hover:text-emerald-400'}`}
              title="Beğendim"
            >
              👍
            </button>
            <button
              onClick={() => onFeedback('negative')}
              className={`p-2 rounded border transition-all ${record.feedback === 'negative' ? 'border-red-500/30 bg-red-500/[0.08] text-red-400' : 'border-white/[0.06] bg-white/[0.02] text-archilya-text-dim/40 hover:text-red-400'}`}
              title="Beğenmedim"
            >
              👎
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try {
                  const result = await window.api.downloadFile(record.imageUrl, `archilya-${record.toolId}-${record.id}.jpg`);
                  if (!result.success && result.error) {
                    console.error('Download failed:', result.error);
                  }
                } catch (err) {
                  console.error('Download error:', err);
                }
              }}
              className="px-3 py-1.5 rounded border border-white/[0.06] bg-white/[0.02] text-[11px] text-archilya-text-dim/60 hover:text-archilya-text hover:bg-white/[0.04] transition-all"
            >
              İndir
            </button>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1.5 rounded border border-red-500/10 bg-red-500/[0.04] text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.08] transition-all"
              >
                Sil
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onDelete}
                  className="px-3 py-1.5 rounded border border-red-500/20 bg-red-500/[0.08] text-[11px] text-red-400 hover:bg-red-500/[0.12] transition-all"
                >
                  Eminim, Sil
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded border border-white/[0.06] bg-white/[0.02] text-[11px] text-archilya-text-dim/40 hover:text-archilya-text transition-all"
                >
                  Vazgeç
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
