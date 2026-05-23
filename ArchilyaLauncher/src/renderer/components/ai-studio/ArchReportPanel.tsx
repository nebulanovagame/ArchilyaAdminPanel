import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ImageUploadZone } from './ImageUploadZone';
import { GenerationSkeleton } from './GenerationSkeleton';
import { REPORT_TYPES, AI_TOOLS } from '../../data/aiStudioMockData';
import { buildAnalysisPrompt } from '../../ai-studio/promptBuilders';
import { saveGeneration } from '../../lib/ai-gallery/storage';
import { useAiSession } from '../../hooks/useAiSession';
import { ARCH_REPORT_TEMPLATES } from '../../ai-studio/promptTemplates';
import { PromptTemplatePicker } from './PromptTemplatePicker';

export const ArchReportPanel: React.FC = () => {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [selectedReportType, setSelectedReportType] = useState<string>(
    REPORT_TYPES[0]?.id ?? 'program-analysis'
  );
  const [prompt, setPrompt] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const {
    isGenerating, resultUrl, error,
    startSession, clearSession,
  } = useAiSession({ toolId: 'arch-report', enabled: true });

  const generatedPrompt = useMemo(() => {
    if (uploadedImages.length === 0) return '';
    return buildAnalysisPrompt(extraNote, prompt);
  }, [uploadedImages, extraNote, prompt]);

  const sessionPromptText = generatedPrompt || extraNote || prompt;

  const handleFilesDrop = useCallback((files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          setUploadedImages((prev) => [...prev, result]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (uploadedImages.length === 0) return;

    await startSession({
      promptText: sessionPromptText,
      sourceImage: uploadedImages[0] || undefined,
    });
  }, [uploadedImages, sessionPromptText, startSession]);

  useEffect(() => {
    if (resultUrl) {
      const tool = AI_TOOLS.find((t) => t.id === 'arch-report');
      void saveGeneration({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolId: 'arch-report',
        toolName: tool?.name || 'Mimari Rapor',
        category: tool?.category || 'analysis-doc',
        promptText: sessionPromptText,
        imageUrl: resultUrl || '',
        sourceImage: uploadedImages[0] || undefined,
        createdAt: Date.now(),
        status: 'completed',
        creditsCost: tool?.creditCost ?? 25,
        feedback: null,
      }).catch((saveError) => {
        console.error('Failed to save AI gallery generation:', saveError);
      });
    }
  }, [resultUrl, sessionPromptText, uploadedImages]);

  useEffect(() => {
    if (error) {
      console.error('ArchReportPanel error:', error);
    }
  }, [error]);

  const handleReset = useCallback(() => {
    setUploadedImages([]);
    setPrompt('');
    setExtraNote('');
    setShowPromptPreview(false);
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
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
        <h2 className="font-display text-sm tracking-[0.18em] text-archilya-text uppercase">
          Mimari Rapor
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
              alt="Mimari rapor sonucu"
              className="w-full h-auto max-h-64 object-contain"
            />
          </div>
          <button
            onClick={handleReset}
            className="w-full py-2.5 text-[11px] font-display tracking-[0.2em] uppercase border border-white/[0.08] text-archilya-text-dim/60 hover:text-archilya-text hover:border-white/[0.16] rounded transition-all duration-200"
          >
            Yeni Rapor Oluştur
          </button>
        </>
      ) : isGenerating ? (
        <GenerationSkeleton text="Mimari analiz yapılıyor..." />
      ) : (
        <>
          {/* Image upload */}
          <ImageUploadZone onFilesDrop={handleFilesDrop} accept="image/*" />

          {/* Thumbnails row */}
          {uploadedImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {uploadedImages.map((img, idx) => (
                <div
                  key={idx}
                  className="relative shrink-0 w-20 h-20 rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden group"
                >
                  <img
                    src={img}
                    alt={`Yüklenen görsel ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => handleRemoveImage(idx)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-black/60 text-white/70 hover:text-white text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="shrink-0 w-20 h-20 rounded-lg border border-dashed border-white/[0.08] flex items-center justify-center text-[10px] text-archilya-text-dim/40">
                +{uploadedImages.length} görsel
              </div>
            </div>
          )}

          {/* Report type selector */}
          {uploadedImages.length > 0 && (
            <>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-3">
                  Rapor Türü
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {REPORT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedReportType(type.id)}
                      className={`
                        text-left p-3 rounded-lg border transition-all duration-200
                        ${
                          selectedReportType === type.id
                            ? 'border-archilya-gold/40 bg-archilya-gold/[0.06]'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
                        }
                      `}
                    >
                      <p
                        className={`text-[11px] font-display tracking-wide ${
                          selectedReportType === type.id
                            ? 'text-archilya-gold'
                            : 'text-archilya-text'
                        }`}
                      >
                        {type.name}
                      </p>
                      <p className="text-[10px] text-archilya-text-dim/50 mt-0.5 leading-snug">
                        {type.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Extra Note */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-3">
                  Ek Notlar (İsteğe Bağlı)
                </p>
                <textarea
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  placeholder="Örn: Özellikle cephe malzeme kalitesine ve sürdürülebilirlik potansiyeline odaklan..."
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

              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
                    Prompt
                  </p>
                  <span className="text-[10px] font-mono text-archilya-text-dim/40">
                    {prompt.length} karakter
                  </span>
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Render açısı ve kompozisyon hakkında yorum yap..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-black/20 px-3.5 py-3 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:outline-none focus:border-archilya-gold/30 transition-colors leading-relaxed"
                />
              </div>

              {/* Prompt Templates */}
              <PromptTemplatePicker
                templates={ARCH_REPORT_TEMPLATES}
                onSelect={(text) => setPrompt((prev) => (prev ? prev + ', ' + text : text))}
              />

              <button
                onClick={handleGenerate}
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
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" x2="8" y1="13" y2="13" />
                  <line x1="16" x2="8" y1="17" y2="17" />
                </svg>
                Rapor Oluştur
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};
