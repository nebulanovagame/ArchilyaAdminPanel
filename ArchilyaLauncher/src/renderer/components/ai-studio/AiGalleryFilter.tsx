import React from 'react';
import type { AiGalleryFilter as AiGalleryFilterType, AiGallerySort } from '../../types/ai-gallery';

interface AiGalleryFilterProps {
  filters: { category: AiGalleryFilterType; searchQuery: string; sort: AiGallerySort };
  onChange: (filters: { category: AiGalleryFilterType; searchQuery: string; sort: AiGallerySort }) => void;
  resultCount: number;
}

const CATEGORY_OPTIONS: { value: AiGalleryFilterType; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'core', label: 'Üretim' },
  { value: 'conversion', label: 'Dönüşüm' },
  { value: 'analysis-doc', label: 'Analiz & Dokümantasyon' },
  { value: 'rd', label: 'Ar-Ge' },
];

const SORT_OPTIONS: { value: AiGallerySort; label: string }[] = [
  { value: 'newest', label: 'En Yeni' },
  { value: 'oldest', label: 'En Eski' },
  { value: 'highest-credits', label: 'En Çok Kredi' },
];

export const AiGalleryFilter: React.FC<AiGalleryFilterProps> = ({
  filters,
  onChange,
  resultCount,
}) => {
  return (
    <div className="flex flex-col gap-4 px-8 py-5 border-b border-white/[0.04]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {CATEGORY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...filters, category: opt.value })}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium tracking-wide transition-all duration-200 ${
                filters.category === opt.value
                  ? 'bg-white/[0.06] text-archilya-gold border border-white/[0.08]'
                  : 'text-archilya-text-dim/50 hover:text-archilya-text hover:bg-white/[0.02] border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono text-archilya-text-dim/30">
            {resultCount} sonuç
          </span>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ ...filters, sort: e.target.value as AiGallerySort })}
            className="bg-white/[0.03] border border-white/[0.06] rounded-md px-2.5 py-1.5 text-[11px] text-archilya-text-dim/70 focus:outline-none focus:border-archilya-gold/30"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-archilya-text-dim/30"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          type="text"
          placeholder="Prompt içinde ara..."
          value={filters.searchQuery}
          onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
          className="w-full bg-white/[0.02] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/20 focus:outline-none focus:border-archilya-gold/30 transition-colors"
        />
      </div>
    </div>
  );
};
