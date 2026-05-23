import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ImageUploadZone } from './ImageUploadZone';
import { GenerationSkeleton } from './GenerationSkeleton';
import { ResultViewer } from './ResultViewer';
import { ROOM_COLOR_PRESETS, AI_TOOLS } from '../../data/aiStudioMockData';
import { useAiSession } from '../../hooks/useAiSession';
import { buildPlanColorPrompt } from '../../ai-studio/promptBuilders';
import { saveGeneration } from '../../lib/ai-gallery/storage';
import { PLAN_COLOR_TEMPLATES } from '../../ai-studio/promptTemplates';
import { PromptTemplatePicker } from './PromptTemplatePicker';

const ROOM_LABELS: Record<string, string> = {
  salon: 'Salon',
  mutfak: 'Mutfak',
  yatak: 'Yatak Odası',
  banyo: 'Banyo',
  calisma: 'Çalışma',
};

export const PlanColorPanel: React.FC = () => {
const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>(ROOM_COLOR_PRESETS[0].id);
  const [extraNote, setExtraNote] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const {
    isGenerating, resultUrl, error,
    startSession, clearSession,
  } = useAiSession({ toolId: 'plan-color', enabled: true });

  const activePreset = ROOM_COLOR_PRESETS.find((p) => p.id === selectedPreset)!;

  const generatedPrompt = useMemo(() => {
    if (!sourceImage) return '';
    return buildPlanColorPrompt({ style: selectedPreset, extraNote });
  }, [sourceImage, selectedPreset, extraNote]);

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

  const handleGenerate = useCallback(async () => {
    if (!sourceImage) return;

    await startSession({
      promptText: sessionPromptText,
      sourceImage: sourceImage || undefined,
    });
  }, [sourceImage, sessionPromptText, startSession]);

  useEffect(() => {
    if (resultUrl) {
      const tool = AI_TOOLS.find((t) => t.id === 'plan-color');
      void saveGeneration({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolId: 'plan-color',
        toolName: tool?.name || 'Plan Boyama',
        category: tool?.category || 'conversion',
        promptText: sessionPromptText,
        imageUrl: resultUrl,
        sourceImage: sourceImage || undefined,
        createdAt: Date.now(),
        status: 'completed',
        creditsCost: tool?.creditCost ?? 12,
        feedback: null,
      }).catch((saveError) => {
        console.error('Failed to save AI gallery generation:', saveError);
      });
    }
  }, [resultUrl, sessionPromptText, sourceImage]);

  useEffect(() => {
    if (error) {
      console.error('PlanColorPanel error:', error);
    }
  }, [error]);

  const handleReset = useCallback(() => {
    setSourceImage(null);
    setSelectedPreset(ROOM_COLOR_PRESETS[0].id);
    setExtraNote('');
    setShowPromptPreview(false);
    clearSession();
  }, [clearSession]);

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return;
    const result = await window.api.downloadFile(resultUrl, 'archilya-plan-boyama-sonuc.png');
    if (!result.success) {
      console.error('Download failed:', result.error);
    }
  }, [resultUrl]);

  const canGenerate = !!sourceImage && !!selectedPreset;

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
          className="text-sky-400/70"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>
        <h2 className="font-display text-sm tracking-[0.18em] text-archilya-text uppercase">
          Plan Boyama
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
            Yeni Boyama
          </button>
        </div>
      ) : isGenerating ? (
        <GenerationSkeleton text="Plan boyanıyor..." />
      ) : (
        <>
          {/* Upload zone */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
              Teknik Plan / Çizim
            </p>
            <ImageUploadZone onFilesDrop={handleFilesDrop} accept="image/*" />
            {sourceImage && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <img
                  src={sourceImage}
                  alt="Teknik plan"
                  className="w-full h-auto max-h-40 object-contain"
                />
              </div>
            )}
          </div>

          {/* Color palette selector */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
              Renk Paleti
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ROOM_COLOR_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`
                      flex flex-col items-center gap-2 p-3 rounded-xl border
                      transition-all duration-200
                      ${
                        isSelected
                          ? 'border-sky-400/40 bg-sky-400/[0.06]'
                          : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]'
                      }
                    `}
                  >
                    {/* Mini swatch row */}
                    <div className="flex gap-1">
                      {Object.values(preset.colors).map((color) => (
                        <div
                          key={color}
                          className="w-4 h-4 rounded-sm border border-white/[0.08]"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <span
                      className={`
                        text-[11px] font-display tracking-wide
                        ${isSelected ? 'text-sky-400' : 'text-archilya-text'}
                      `}
                    >
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected palette detail with room labels */}
          {activePreset && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/50">
                {activePreset.name} — Oda Renkleri
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(activePreset.colors).map(([roomKey, color]) => (
                  <div
                    key={roomKey}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.02] px-2.5 py-2"
                  >
                    <div
                      className="w-5 h-5 rounded border border-white/[0.08] shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[10px] text-archilya-text-dim/70 leading-tight">
                      {ROOM_LABELS[roomKey] || roomKey}
                    </span>
                  </div>
                ))}
              </div>
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
              placeholder="Örn: Yemek alanında sıcak ahşap tonları, banyoda mermer dokusu..."
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
            templates={PLAN_COLOR_TEMPLATES}
            onSelect={(text) => setExtraNote((prev) => (prev ? prev + ', ' + text : text))}
          />

          {/* Action button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full py-3 text-xs font-display tracking-[0.2em] uppercase border border-sky-400/40 text-sky-400 hover:bg-sky-400 hover:text-black rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            Boyama Yap
          </button>
        </>
      )}
    </div>
  );
};
