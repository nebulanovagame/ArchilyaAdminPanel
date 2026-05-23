import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ImageUploadZone } from './ImageUploadZone';
import { GenerationSkeleton } from './GenerationSkeleton';
import { ResultViewer } from './ResultViewer';
import { ENHANCEMENT_TYPES, AI_TOOLS } from '../../data/aiStudioMockData';
import { buildEnhancedRenderPrompt } from '../../ai-studio/promptBuilders';
import { saveGeneration } from '../../lib/ai-gallery/storage';
import { useAiSession } from '../../hooks/useAiSession';
import { ENHANCE_TEMPLATES } from '../../ai-studio/promptTemplates';
import { PromptTemplatePicker } from './PromptTemplatePicker';

export const EnhancePanel: React.FC = () => {
const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>(ENHANCEMENT_TYPES[0].id);
  const [extraNote, setExtraNote] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const {
    isGenerating, resultUrl, error,
    startSession, clearSession,
  } = useAiSession({ toolId: 'enhance', enabled: true });

  const activeType = ENHANCEMENT_TYPES.find((t) => t.id === selectedType)!;

  const generatedPrompt = useMemo(() => {
    if (!sourceImage) return '';
    return buildEnhancedRenderPrompt({ extraNote });
  }, [sourceImage, extraNote]);

  const sessionPromptText = generatedPrompt || extraNote;

  const handleFilesDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceImage((e.target?.result as string) || null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleEnhance = useCallback(async () => {
    if (!sourceImage) return;

    await startSession({
      promptText: sessionPromptText,
      sourceImage: sourceImage || undefined,
    });
  }, [sourceImage, sessionPromptText, startSession]);

  useEffect(() => {
    if (resultUrl) {
      const tool = AI_TOOLS.find((t) => t.id === 'enhance');
      void saveGeneration({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolId: 'enhance',
        toolName: tool?.name || 'Render İyileştirme',
        category: tool?.category || 'conversion',
        promptText: sessionPromptText,
        imageUrl: resultUrl,
        sourceImage: sourceImage || undefined,
        createdAt: Date.now(),
        status: 'completed',
        creditsCost: tool?.creditCost ?? 10,
        feedback: null,
      }).catch((saveError) => {
        console.error('Failed to save AI gallery generation:', saveError);
      });
    }
  }, [resultUrl, sessionPromptText, sourceImage]);

  useEffect(() => {
    if (error) {
      console.error('EnhancePanel error:', error);
    }
  }, [error]);

  const handleReset = useCallback(() => {
    setSourceImage(null);
    setSelectedType(ENHANCEMENT_TYPES[0].id);
    setExtraNote('');
    setShowPromptPreview(false);
    clearSession();
  }, [clearSession]);

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return;
    const result = await window.api.downloadFile(resultUrl, 'archilya-iyilestirme-sonuc.png');
    if (!result.success) {
      console.error('Download failed:', result.error);
    }
  }, [resultUrl]);

  const canEnhance = !!sourceImage && !!selectedType;

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
          <path d="M15 3h6v6" />
          <path d="M9 21H3v-6" />
          <path d="M21 3l-7 7" />
          <path d="M3 21l7-7" />
        </svg>
        <h2 className="font-display text-sm tracking-[0.18em] text-archilya-text uppercase">
          Render İyileştirme
        </h2>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4">
          <p className="text-[11px] text-red-400 leading-relaxed">{error}</p>
        </div>
      )}

      {resultUrl ? (
        <div className="space-y-3">
          <ResultViewer imageUrl={resultUrl} onDownload={handleDownload} />
          <button
            onClick={handleReset}
            className="w-full py-2.5 text-[11px] font-display tracking-[0.2em] uppercase border border-white/[0.08] text-archilya-text-dim/60 hover:text-archilya-text hover:border-white/[0.16] rounded transition-all duration-200"
          >
            Yeni İyileştirme
          </button>
        </div>
      ) : isGenerating ? (
        <GenerationSkeleton text="Render iyileştiriliyor..." />
      ) : (
        <>
          {/* Upload zone */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
              Kaynak Görsel
            </p>
            <ImageUploadZone onFilesDrop={handleFilesDrop} accept="image/*" />
            {sourceImage && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <img
                  src={sourceImage}
                  alt="Kaynak render"
                  className="w-full h-auto max-h-40 object-contain"
                />
              </div>
            )}
          </div>

          {/* Enhancement type selector */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
              İyileştirme Türü
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ENHANCEMENT_TYPES.map((type) => {
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`
                      flex flex-col items-start gap-1 p-3 rounded-xl border text-left
                      transition-all duration-200
                      ${
                        isSelected
                          ? 'border-archilya-gold/40 bg-archilya-gold/[0.06]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]'
                      }
                    `}
                  >
                    <span
                      className={`
                        text-[11px] font-display tracking-wide
                        ${isSelected ? 'text-archilya-gold' : 'text-archilya-text'}
                      `}
                    >
                      {type.name}
                    </span>
                    <span
                      className={`
                        text-[10px] leading-relaxed
                        ${isSelected ? 'text-archilya-text-dim/80' : 'text-archilya-text-dim/50'}
                      `}
                    >
                      {type.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected type description highlight */}
          {activeType && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/50 mb-1">
                Seçili İşlem
              </p>
              <p className="text-[11px] text-archilya-text-dim/70 leading-relaxed">
                {activeType.description}
              </p>
            </div>
          )}

          {/* Extra Note */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-3">
              Ek Notlar (İsteğe Bağlı)
            </p>
            <textarea
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="Örn: Cam yüzeylerde yansıma detaylarını güçlendir, gökyüzü gradientini iyileştir..."
              rows={3}
              className="w-full resize-none rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-3 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:outline-none focus:border-archilya-gold/30 transition-colors leading-relaxed"
            />
          </div>

          {/* Prompt Preview */}
          {generatedPrompt && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <button
                onClick={() => setShowPromptPreview(!showPromptPreview)}
                className="flex items-center justify-between w-full text-left"
              >
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
                  Prompt Önizleme
                </p>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-archilya-text-dim/50 transition-transform duration-200 ${showPromptPreview ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showPromptPreview && (
                <pre className="mt-3 p-3 rounded-lg bg-black/30 border border-white/[0.04] text-[10px] text-archilya-text-dim/70 leading-relaxed overflow-auto max-h-64 whitespace-pre-wrap font-mono">
                  <code>{generatedPrompt}</code>
                </pre>
              )}
            </div>
          )}

          {/* Prompt Templates */}
          <PromptTemplatePicker
            templates={ENHANCE_TEMPLATES}
            onSelect={(text) => setExtraNote((prev) => (prev ? prev + ', ' + text : text))}
          />

          {/* Action button */}
          <button
            onClick={handleEnhance}
            disabled={!canEnhance}
            className="w-full py-3 text-xs font-display tracking-[0.2em] uppercase border border-archilya-gold/40 text-archilya-gold hover:bg-archilya-gold hover:text-black rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </svg>
            İyileştir
          </button>
        </>
      )}
    </div>
  );
};
