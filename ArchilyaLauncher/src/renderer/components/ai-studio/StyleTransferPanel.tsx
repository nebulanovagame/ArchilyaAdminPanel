import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ImageUploadZone } from './ImageUploadZone';
import { GenerationSkeleton } from './GenerationSkeleton';
import { ResultViewer } from './ResultViewer';
import { STYLE_OPTIONS, AI_TOOLS } from '../../data/aiStudioMockData';
import { buildTransformStylePrompt } from '../../ai-studio/promptBuilders';
import { saveGeneration } from '../../lib/ai-gallery/storage';
import { STYLE_TRANSFER_TEMPLATES } from '../../ai-studio/promptTemplates';
import { PromptTemplatePicker } from './PromptTemplatePicker';
import { useAiSession } from '../../hooks/useAiSession';

export const StyleTransferPanel: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [extraNote, setExtraNote] = useState('');
  const [prompt, setPrompt] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const {
    isGenerating,
    resultUrl,
    error,
    startSession,
    clearSession,
  } = useAiSession({ toolId: 'style-transfer', enabled: true });

  const generatedPrompt = useMemo(() => {
    if (!uploadedImage || !selectedStyle) return '';
    return buildTransformStylePrompt({ style: selectedStyle, extraNote });
  }, [uploadedImage, selectedStyle, extraNote]);

  const sessionPromptText = generatedPrompt || extraNote || prompt;

  // Save generation when resultUrl changes
  useEffect(() => {
    if (resultUrl && uploadedImage) {
      const tool = AI_TOOLS.find((t) => t.id === 'style-transfer');
      void saveGeneration({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolId: 'style-transfer',
        toolName: tool?.name || 'Stil Dönüşümü',
        category: tool?.category || 'conversion',
        promptText: sessionPromptText,
        imageUrl: resultUrl,
        sourceImage: uploadedImage || undefined,
        createdAt: Date.now(),
        status: 'completed',
        creditsCost: tool?.creditCost ?? 20,
        feedback: null,
      }).catch((saveError) => {
        console.error('Failed to save AI gallery generation:', saveError);
      });
    }
  }, [resultUrl, uploadedImage, sessionPromptText]);

  useEffect(() => {
    if (error) {
      console.error('StyleTransferPanel error:', error);
    }
  }, [error]);

  const handleFilesDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage((e.target?.result as string) || null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!uploadedImage || !selectedStyle) return;

    await startSession({
      promptText: sessionPromptText,
      sourceImage: uploadedImage,
      params: { style: selectedStyle },
    });
  }, [uploadedImage, selectedStyle, sessionPromptText, startSession]);

  const handleReset = useCallback(() => {
    setUploadedImage(null);
    setSelectedStyle(null);
    setExtraNote('');
    setShowPromptPreview(false);
    clearSession();
  }, [clearSession]);

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return;
    try {
      const result = await window.api.downloadFile(resultUrl, 'archilya-stil-transfer.png');
      if (!result.success && result.error) {
        console.error('Download failed:', result.error);
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  }, [resultUrl]);

  const handleSaveToFolder = useCallback(() => {
    if (!resultUrl) return;
    alert('Render 05_Musteri_Sunumlari klasörüne kaydedildi (Demo).');
  }, [resultUrl]);

  const selectedStyleData = STYLE_OPTIONS.find((s) => s.id === selectedStyle);

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
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
        </svg>
        <h2 className="font-display text-sm tracking-[0.18em] text-archilya-text uppercase">
          Stil Dönüşümü
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
            Yeni Dönüşüm Başlat
          </button>
        </div>
      ) : isGenerating ? (
        <GenerationSkeleton text="Stil dönüşümü uygulanıyor..." />
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
                  alt="Kaynak render"
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
                  placeholder="Cepheye daha fazla yeşil bitki örtüsü ekle..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/[0.06] bg-black/20 px-3.5 py-3 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:outline-none focus:border-archilya-gold/30 transition-colors leading-relaxed"
                />
              </div>

              {/* Prompt Templates */}
              <PromptTemplatePicker
                templates={STYLE_TRANSFER_TEMPLATES}
                onSelect={(text) => setPrompt((prev) => (prev ? prev + ', ' + text : text))}
              />

              {/* Target Style — Big Visual Cards */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-4">
                  Hedef Stil
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {STYLE_OPTIONS.map((opt) => {
                    const isActive = selectedStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setSelectedStyle(opt.id)}
                        className={`
                          relative overflow-hidden rounded-xl border
                          transition-all duration-300 text-left group
                          ${
                            isActive
                              ? 'border-archilya-gold/50 ring-1 ring-archilya-gold/30'
                              : 'border-white/[0.06] hover:border-white/[0.14]'
                          }
                        `}
                      >
                        {/* Preview Image */}
                        <div className="relative w-full h-28 overflow-hidden">
                          <img
                            src={opt.previewUrl}
                            alt={opt.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          {/* Active indicator */}
                          {isActive && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-archilya-gold flex items-center justify-center">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="black"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            </div>
                          )}
                        </div>
                        {/* Label */}
                        <div className="p-2.5 bg-white/[0.02]">
                          <span className={`block text-[11px] font-display tracking-wide ${isActive ? 'text-archilya-gold' : 'text-archilya-text'}`}>
                            {opt.name}
                          </span>
                          <span className={`block text-[9px] mt-0.5 leading-snug ${isActive ? 'text-archilya-gold/50' : 'text-archilya-text-dim/40'}`}>
                            {opt.description}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Selected Style Summary */}
              {selectedStyleData && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-archilya-gold/20 bg-archilya-gold/[0.04]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-display tracking-wide text-archilya-gold">
                      {selectedStyleData.name} stiline dönüştürülecek
                    </p>
                    <p className="text-[9px] text-archilya-text-dim/50 mt-0.5 truncate">
                      {selectedStyleData.description}
                    </p>
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
                  placeholder="Örn: Daha sıcak tonlar, doğal taş kaplama vurgusu..."
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

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!uploadedImage || !selectedStyle}
                className="w-full py-3 text-xs font-display tracking-[0.2em] uppercase border border-archilya-gold/40 text-archilya-gold hover:bg-archilya-gold hover:text-black rounded transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-archilya-gold"
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
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
                </svg>
                Dönüştür
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};
