import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ImageUploadZone } from './ImageUploadZone';
import { GenerationSkeleton } from './GenerationSkeleton';
import { AI_TOOLS } from '../../data/aiStudioMockData';
import { saveGeneration } from '../../lib/ai-gallery/storage';
import { useAiSession } from '../../hooks/useAiSession';

export const MaterialListPanel: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const generatedPrompt = useMemo(() => {
    if (!uploadedImage) return '';
    return 'Analyze image for materials';
  }, [uploadedImage]);

  const {
    isGenerating, resultUrl, error,
    startSession, clearSession,
  } = useAiSession({ toolId: 'material-list', enabled: true });

  const handleFilesDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage((e.target?.result as string) || null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDetect = useCallback(async () => {
    if (!uploadedImage) return;

    await startSession({
      promptText: generatedPrompt,
      sourceImage: uploadedImage || undefined,
    });
  }, [generatedPrompt, uploadedImage, startSession]);

  useEffect(() => {
    if (resultUrl) {
      const tool = AI_TOOLS.find((t) => t.id === 'material-list');
      void saveGeneration({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolId: 'material-list',
        toolName: tool?.name || 'Malzeme Listesi',
        category: tool?.category || 'analysis-doc',
        promptText: generatedPrompt,
        imageUrl: resultUrl,
        sourceImage: uploadedImage || undefined,
        createdAt: Date.now(),
        status: 'completed',
        creditsCost: tool?.creditCost ?? 15,
        feedback: null,
      }).catch((saveError) => {
        console.error('Failed to save AI gallery generation:', saveError);
      });
    }
  }, [generatedPrompt, resultUrl, uploadedImage]);

  useEffect(() => {
    if (error) {
      console.error('MaterialListPanel error:', error);
    }
  }, [error]);

  const handleReset = useCallback(() => {
    setUploadedImage(null);
    clearSession();
  }, [clearSession]);

  return (
      <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-white/[0.06]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-archilya-gold/70"
        >
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect width="4" height="4" x="10" y="3" rx="1" />
          <line x1="9" x2="15" y1="12" y2="12" />
          <line x1="9" x2="15" y1="16" y2="16" />
        </svg>
        <h2 className="font-display text-sm tracking-[0.18em] text-archilya-text uppercase">
          Malzeme Listesi
        </h2>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4">
          <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>
        </div>
      )}

      {resultUrl ? (
        <>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <img
              src={resultUrl}
              alt="Malzeme analiz sonucu"
              className="w-full h-auto max-h-64 object-contain"
            />
          </div>
          <button
            onClick={handleReset}
            className="w-full py-2.5 text-[11px] font-display tracking-[0.2em] uppercase border border-white/[0.08] text-archilya-text-dim/60 hover:text-archilya-text hover:border-white/[0.16] rounded transition-all duration-200"
          >
            Yeni Tespit
          </button>
        </>
      ) : isGenerating ? (
        <GenerationSkeleton text="Malzemeler analiz ediliyor..." />
      ) : (
        <>
          <ImageUploadZone onFilesDrop={handleFilesDrop} accept="image/*" />

          {uploadedImage && (
            <>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <img
                  src={uploadedImage}
                  alt="Yüklenen görsel"
                  className="w-full h-auto max-h-64 object-contain"
                />
              </div>

              <button
                onClick={handleDetect}
                className="w-full py-3 text-xs font-display tracking-[0.2em] uppercase border border-archilya-gold/40 text-archilya-gold hover:bg-archilya-gold hover:text-black rounded transition-all duration-200 flex items-center justify-center gap-2"
              >
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
                >
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                  <rect width="4" height="4" x="10" y="3" rx="1" />
                  <line x1="9" x2="15" y1="12" y2="12" />
                  <line x1="9" x2="15" y1="16" y2="16" />
                </svg>
                Malzemeleri Tespit Et
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};
