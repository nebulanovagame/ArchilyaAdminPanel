import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ImageUploadZone } from './ImageUploadZone';
import { GenerationSkeleton } from './GenerationSkeleton';
import { ResultViewer } from './ResultViewer';
import { STYLE_OPTIONS, LIGHTING_PRESETS, AI_TOOLS } from '../../data/aiStudioMockData';
import { buildSketchupRenderPrompt } from '../../ai-studio/promptBuilders';
import { saveGeneration } from '../../lib/ai-gallery/storage';
import { SKETCHUP_RENDER_TEMPLATES } from '../../ai-studio/promptTemplates';
import { PromptTemplatePicker } from './PromptTemplatePicker';
import { useAiSession } from '../../hooks/useAiSession';

export const SketchupRenderPanel: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('modern');
  const [selectedLighting, setSelectedLighting] = useState('golden-hour');
  const [extraNote, setExtraNote] = useState('');
  const [prompt, setPrompt] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const {
    isGenerating, resultUrl, error,
    startSession, clearSession,
  } = useAiSession({ toolId: 'sketchup-render', enabled: true });

  const generatedPrompt = useMemo(() => {
    if (!uploadedImage) return '';
    return buildSketchupRenderPrompt({
      style: selectedStyle,
      lighting: selectedLighting,
      extraNote,
    });
  }, [uploadedImage, selectedStyle, selectedLighting, extraNote]);

  const sessionPromptText = generatedPrompt || extraNote || prompt;

  const handleFilesDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage((e.target?.result as string) || null);
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (error) {
      console.error('SketchupRenderPanel error:', error);
    }
  }, [error]);

  const handleGenerate = useCallback(async () => {
    if (!uploadedImage) return;

    await startSession({
      promptText: sessionPromptText,
      sourceImage: uploadedImage || undefined,
      params: { style: selectedStyle, lighting: selectedLighting },
    });
  }, [uploadedImage, selectedStyle, selectedLighting, sessionPromptText, startSession]);

  useEffect(() => {
    if (resultUrl) {
      const tool = AI_TOOLS.find((t) => t.id === 'sketchup-render');
      void saveGeneration({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolId: 'sketchup-render',
        toolName: tool?.name || 'SketchUp Render',
        category: tool?.category || 'core',
        promptText: sessionPromptText,
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
  }, [resultUrl, sessionPromptText, uploadedImage]);

  const handleReset = useCallback(() => {
    setUploadedImage(null);
    setSelectedStyle('modern');
    setSelectedLighting('golden-hour');
    setExtraNote('');
    setShowPromptPreview(false);
    clearSession();
  }, [clearSession]);

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return;
    const result = await window.api.downloadFile(resultUrl, 'archilya-sketchup-render.png');
    if (!result.success) {
      console.error('Download failed:', result.error);
    }
  }, [resultUrl]);

  const handleSaveToFolder = useCallback(() => {
    if (!resultUrl) return;
    alert('Render 05_Musteri_Sunumlari klasörüne kaydedildi (Demo).');
  }, [resultUrl]);

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
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
        <h2 className="font-display text-sm tracking-[0.18em] text-archilya-text uppercase">
          SketchUp Render
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
          <ResultViewer
            imageUrl={resultUrl}
            onDownload={handleDownload}
            onSaveToFolder={handleSaveToFolder}
          />
          <button
            onClick={handleReset}
            className="w-full py-2.5 text-[11px] font-display tracking-[0.2em] uppercase border border-white/[0.08] text-archilya-text-dim/60 hover:text-archilya-text hover:border-white/[0.16] rounded transition-all duration-200"
          >
            Yeni Render Oluştur
          </button>
        </div>
      ) : isGenerating ? (
        <GenerationSkeleton text="SketchUp modeli render ediliyor..." />
      ) : (
        <>
          {/* Upload Zone */}
          <ImageUploadZone onFilesDrop={handleFilesDrop} accept="image/*" />

          {uploadedImage && (
            <>
              {/* Uploaded Preview */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <img
                  src={uploadedImage}
                  alt="Yüklenen SketchUp ekran görüntüsü"
                  className="w-full h-auto max-h-64 object-contain"
                />
              </div>

              {/* Prompt input */}
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
                  placeholder="Photorealistic dış mekan render, doğal ışık..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-black/20 px-3.5 py-3 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:outline-none focus:border-archilya-gold/30 transition-colors leading-relaxed"
                />
              </div>

              {/* Prompt Templates */}
              <PromptTemplatePicker
                templates={SKETCHUP_RENDER_TEMPLATES}
                onSelect={(text) => setPrompt((prev) => (prev ? prev + ', ' + text : text))}
              />

              {/* Style Grid */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-3">
                  Mimari Stil
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {STYLE_OPTIONS.map((opt) => {
                    const isActive = selectedStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedStyle(opt.id)}
                        className={`
                          px-2.5 py-2 rounded border text-[11px] tracking-wide
                          transition-all duration-200 text-left
                          ${
                            isActive
                              ? 'bg-archilya-gold/10 border-archilya-gold/40 text-archilya-gold'
                              : 'bg-white/[0.02] border-white/[0.06] text-archilya-text-dim/70 hover:text-archilya-text hover:border-white/[0.12] hover:bg-white/[0.03]'
                          }
                        `}
                      >
                        <span className="block font-medium">{opt.name}</span>
                        <span className={`block text-[9px] mt-0.5 leading-snug ${isActive ? 'text-archilya-gold/60' : 'text-archilya-text-dim/40'}`}>
                          {opt.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lighting Presets */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-3">
                  Işık Koşulları
                </p>
                <div className="flex flex-wrap gap-2">
                  {LIGHTING_PRESETS.map((preset) => {
                    const isActive = selectedLighting === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setSelectedLighting(preset.id)}
                        className={`
                          px-3 py-1.5 rounded border text-[11px] tracking-wide
                          transition-all duration-200
                          ${
                            isActive
                              ? 'bg-archilya-gold/10 border-archilya-gold/40 text-archilya-gold'
                              : 'bg-white/[0.02] border-white/[0.06] text-archilya-text-dim/70 hover:text-archilya-text hover:border-white/[0.12] hover:bg-white/[0.03]'
                          }
                        `}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
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
                  placeholder="Örn: Cepheye ahşap panel detayları ekle, peyzajı zeytin ağaçlarıyla zenginleştir..."
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
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                </svg>
                Oluştur
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};
