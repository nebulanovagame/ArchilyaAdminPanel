import React from 'react';
import type { AiGenerationRecord } from '../../types/ai-gallery';

interface AiGalleryCardProps {
  record: AiGenerationRecord;
  onClick: () => void;
  onDelete: () => void;
}

export const AiGalleryCard: React.FC<AiGalleryCardProps> = ({
  record,
  onClick,
  onDelete,
}) => {
  const dateStr = new Date(record.createdAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const categoryColors: Record<string, string> = {
    core: 'text-emerald-400/70',
    conversion: 'text-amber-400/70',
    'analysis-doc': 'text-sky-400/70',
    rd: 'text-violet-400/70',
  };

  const categoryLabels: Record<string, string> = {
    core: 'Üretim',
    conversion: 'Dönüşüm',
    'analysis-doc': 'Analiz',
    rd: 'Ar-Ge',
  };

  return (
    <div
      onClick={onClick}
      className="group relative rounded-xl border border-white/[0.04] bg-white/[0.01] overflow-hidden cursor-pointer hover:border-white/[0.10] hover:bg-white/[0.03] transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={record.imageUrl}
          alt={record.toolName}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm ${categoryColors[record.category] || 'text-archilya-text-dim/50'}`}>
            {categoryLabels[record.category] || record.category}
          </span>
        </div>

        {/* Feedback icon */}
        {record.feedback && (
          <div className="absolute top-2 right-2">
            <span className={`text-[10px] px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm ${record.feedback === 'positive' ? 'text-emerald-400' : 'text-red-400'}`}>
              {record.feedback === 'positive' ? '👍' : '👎'}
            </span>
          </div>
        )}

        {/* Hover actions */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const result = await window.api.downloadFile(record.imageUrl, `archilya-${record.toolId}-${record.id}.jpg`);
                if (!result.success && result.error) {
                  console.error('Download failed:', result.error);
                }
              } catch (err) {
                console.error('Download error:', err);
              }
            }}
            className="p-1.5 rounded bg-black/60 backdrop-blur-sm text-white/70 hover:text-archilya-gold transition-colors"
            title="İndir"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded bg-black/60 backdrop-blur-sm text-white/70 hover:text-red-400 transition-colors"
            title="Sil"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-1.5">
        <h3 className="text-[12px] font-medium text-archilya-text truncate">{record.toolName}</h3>
        <p className="text-[10px] text-archilya-text-dim/40 truncate">{record.promptText || 'Prompt belirtilmemiş'}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="text-[9px] font-mono text-archilya-text-dim/30">{dateStr}</span>
          <span className="text-[9px] font-mono text-archilya-gold/50">{record.creditsCost} Kredi</span>
        </div>
      </div>
    </div>
  );
};
