import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { getGenerations, deleteGeneration, updateGeneration } from '../lib/ai-gallery/storage';
import { AiGalleryFilter } from '../components/ai-studio/AiGalleryFilter';
import { AiGalleryCard } from '../components/ai-studio/AiGalleryCard';
import { AiGalleryDetail } from '../components/ai-studio/AiGalleryDetail';
import type { AiGenerationRecord, AiGalleryFilter as FilterType, AiGallerySort } from '../types/ai-gallery';

export const AiGalleryView: React.FC = () => {
  const [records, setRecords] = useState<AiGenerationRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AiGenerationRecord | null>(null);
  const [filters, setFilters] = useState<{ category: FilterType; searchQuery: string; sort: AiGallerySort }>({
    category: 'all',
    searchQuery: '',
    sort: 'newest',
  });

  const loadGenerations = useCallback(async () => {
    try {
      setRecords(await getGenerations());
    } catch (error) {
      console.error('Failed to load AI gallery records:', error);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    void getGenerations()
      .then((nextRecords) => {
        if (isMounted) {
          setRecords(nextRecords);
        }
      })
      .catch((error) => {
        console.error('Failed to load AI gallery records:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    let result = [...records];

    if (filters.category !== 'all') {
      result = result.filter((r) => r.category === filters.category);
    }

    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.promptText.toLowerCase().includes(query) ||
          r.toolName.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      switch (filters.sort) {
        case 'newest':
          return b.createdAt - a.createdAt;
        case 'oldest':
          return a.createdAt - b.createdAt;
        case 'highest-credits':
          return b.creditsCost - a.creditsCost;
        default:
          return 0;
      }
    });

    return result;
  }, [records, filters]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteGeneration(id);
      await loadGenerations();
      if (selectedRecord?.id === id) {
        setSelectedRecord(null);
      }
    } catch (error) {
      console.error('Failed to delete AI gallery record:', error);
    }
  }, [loadGenerations, selectedRecord]);

  const handleFeedback = useCallback(async (id: string, type: 'positive' | 'negative') => {
    const record = records.find((r) => r.id === id);
    if (!record) return;
    const newFeedback = record.feedback === type ? null : type;
    try {
      await updateGeneration(id, { feedback: newFeedback });
      await loadGenerations();
      if (selectedRecord?.id === id) {
        setSelectedRecord({ ...selectedRecord, feedback: newFeedback });
      }
    } catch (error) {
      console.error('Failed to update AI gallery feedback:', error);
    }
  }, [loadGenerations, records, selectedRecord]);

  const hasRecords = records.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-8 py-6 border-b border-white/[0.04]">
        <div>
          <h1 className="text-xl font-display text-archilya-text tracking-wide">AI Galeri</h1>
          <p className="text-[11px] text-archilya-text-dim/50 mt-1">
            Tüm AI üretimlerinizin geçmişi ve koleksiyonu
          </p>
        </div>
      </div>

      <AiGalleryFilter
        filters={filters}
        onChange={setFilters}
        resultCount={filteredRecords.length}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {!hasRecords ? (
          <div className="flex flex-col items-center justify-center h-full text-archilya-text-dim/20 gap-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <p className="text-sm font-display tracking-wide">Henüz bir AI üretiminiz yok</p>
            <p className="text-[11px] text-archilya-text-dim/15">
              AI Stüdyo'dan bir üretim yaptığınızda burada görünecek
            </p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-archilya-text-dim/20 gap-2">
            <p className="text-sm font-display tracking-wide">Sonuç bulunamadı</p>
            <p className="text-[11px] text-archilya-text-dim/15">Filtreleri değiştirmeyi deneyin</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRecords.map((record) => (
              <AiGalleryCard
                key={record.id}
                record={record}
                onClick={() => setSelectedRecord(record)}
                onDelete={() => handleDelete(record.id)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedRecord && (
        <AiGalleryDetail
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onFeedback={(type) => handleFeedback(selectedRecord.id, type)}
          onDelete={() => handleDelete(selectedRecord.id)}
        />
      )}
    </div>
  );
};
