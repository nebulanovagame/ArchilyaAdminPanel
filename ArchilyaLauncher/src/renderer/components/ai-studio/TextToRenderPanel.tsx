import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GenerationSkeleton } from './GenerationSkeleton';
import { ResultViewer } from './ResultViewer';
import { PromptTemplatePicker } from './PromptTemplatePicker';
// import { AiPromptSuggestions } from './AiPromptSuggestions'; // TODO: integrate image analysis suggestions
import { PromptHistoryPanel, addToPromptHistory } from './PromptHistoryPanel';
import { AI_TOOLS, STYLE_OPTIONS } from '../../data/aiStudioMockData';
import { buildTextToRenderPrompt } from '../../ai-studio/promptBuilders';
import { saveGeneration } from '../../lib/ai-gallery/storage';
import { useAiSession } from '../../hooks/useAiSession';
import { TEXT_TO_RENDER_TEMPLATES } from '../../ai-studio/promptTemplates';

const ASPECT_RATIOS = [
  { id: '16:9', label: '16:9', description: 'Geniş ekran' },
  { id: '4:3', label: '4:3', description: 'Standart' },
  { id: '1:1', label: '1:1', description: 'Kare' },
  { id: '9:16', label: '9:16', description: 'Dikey' },
  { id: '21:9', label: '21:9', description: 'Ultra geniş' },
] as const;

export const TextToRenderPanel: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedAspectRatio, setSelectedAspectRatio] = useState('16:9');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const {
    isGenerating,
    statusMessage,
    resultUrl,
    error,
    startSession,
    clearSession,
    recoverSession,
  } = useAiSession({
    toolId: 'text-to-render',
    enabled: true,
  });

  // Session recovery on mount
  const recoveredPromptText = useMemo(() => {
    const session = recoverSession();
    if (session?.status === 'generating') {
      return session.promptText;
    }

    if (session?.status === 'completed' && resultUrl) {
      return session.promptText;
    }

    return null;
  }, [recoverSession, resultUrl]);

  useEffect(() => {
    if (!recoveredPromptText) return;

    const frameId = window.requestAnimationFrame(() => {
      setPrompt(recoveredPromptText);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [recoveredPromptText]);

  // Log errors
  useEffect(() => {
    if (error) {
      console.error('AI Session error:', error);
    }
  }, [error]);

  const generatedPrompt = useMemo(() => {
    if (!prompt.trim()) return '';
    return buildTextToRenderPrompt({
      prompt,
      style: selectedStyle || 'modern',
      aspectRatio: selectedAspectRatio,
      extraNote,
    });
  }, [prompt, selectedStyle, selectedAspectRatio, extraNote]);

  const sessionPromptText = generatedPrompt || extraNote || prompt;

  // Save generation when resultUrl changes
  useEffect(() => {
    if (resultUrl && sessionPromptText) {
      const tool = AI_TOOLS.find((t) => t.id === 'text-to-render');
      void saveGeneration({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolId: 'text-to-render',
        toolName: tool?.name || 'Metinden Render',
        category: tool?.category || 'core',
        promptText: sessionPromptText,
        imageUrl: resultUrl,
        createdAt: Date.now(),
        status: 'completed',
        creditsCost: tool?.creditCost ?? 20,
        feedback: null,
      }).catch((saveError) => {
        console.error('Failed to save AI gallery generation:', saveError);
      });
    }
  }, [resultUrl, sessionPromptText]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    // Save to history
    addToPromptHistory('text-to-render', prompt);

    await startSession({ promptText: sessionPromptText });
  }, [prompt, sessionPromptText, startSession]);

  const handleReset = useCallback(() => {
    setPrompt('');
    setSelectedAspectRatio('16:9');
    setSelectedStyle('');
    setExtraNote('');
    setShowPromptPreview(false);
    clearSession();
  }, [clearSession]);

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return;
    const result = await window.api.downloadFile(resultUrl, 'archilya-text-render.png');
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
          <path d="M12 3v18" />
          <path d="M3 12h18" />
        </svg>
        <h2 className="font-display text-sm tracking-[0.18em] text-archilya-text uppercase">
          Metinden Render
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
        <GenerationSkeleton text={statusMessage || 'Metinden render üretiliyor...'} />
      ) : (
        <>
          {/* Prompt Textarea */}
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
              placeholder="A modern villa with infinity pool overlooking Mediterranean sea at golden hour..."
              className="w-full h-44 resize-none rounded-lg border border-white/[0.06] bg-black/20 px-3.5 py-3 text-[12px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:outline-none focus:border-archilya-gold/30 transition-colors leading-relaxed"
            />
          </div>

          {/* Prompt Templates */}
          <PromptTemplatePicker
            templates={TEXT_TO_RENDER_TEMPLATES}
            onSelect={(text) => setPrompt((prev) => (prev ? prev + ', ' + text : text))}
          />

          {/* Prompt History */}
          <PromptHistoryPanel
            toolId="text-to-render"
            onSelect={(text) => setPrompt(text)}
          />

          {/* Aspect Ratio Selector */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-3">
              En / Boy Oranı
            </p>
            <div className="flex gap-2">
              {ASPECT_RATIOS.map((ratio) => {
                const isActive = selectedAspectRatio === ratio.id;
                return (
                  <button
                    key={ratio.id}
                    onClick={() => setSelectedAspectRatio(ratio.id)}
                    className={`
                      flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border
                      transition-all duration-200
                      ${
                        isActive
                          ? 'bg-archilya-gold/10 border-archilya-gold/40 text-archilya-gold'
                          : 'bg-white/[0.02] border-white/[0.06] text-archilya-text-dim/70 hover:text-archilya-text hover:border-white/[0.12] hover:bg-white/[0.03]'
                      }
                    `}
                  >
                    {/* Visual ratio indicator */}
                    <div
                      className={`
                        border rounded-sm transition-colors duration-200
                        ${isActive ? 'border-archilya-gold/60' : 'border-archilya-text-dim/30'}
                      `}
                      style={{
                        width: ratio.id === '9:16' ? '12px' : ratio.id === '1:1' ? '20px' : ratio.id === '21:9' ? '28px' : ratio.id === '16:9' ? '24px' : '20px',
                        height: ratio.id === '9:16' ? '20px' : ratio.id === '1:1' ? '20px' : ratio.id === '21:9' ? '10px' : '14px',
                      }}
                    />
                    <span className="text-[10px] font-mono tracking-wider">{ratio.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Style Dropdown */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-3">
              Mimari Stil
            </p>
            <select
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2.5 text-[11px] text-archilya-text focus:outline-none focus:border-archilya-gold/30 transition-colors appearance-none cursor-pointer"
            >
              <option value="">Stil seçin (isteğe bağlı)</option>
              {STYLE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
            {selectedStyle && (
              <p className="mt-2 text-[10px] text-archilya-text-dim/50 leading-relaxed">
                {STYLE_OPTIONS.find((s) => s.id === selectedStyle)?.description}
              </p>
            )}
          </div>

          {/* Extra Note */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60 mb-3">
              Ek Notlar (İsteğe Bağlı)
            </p>
            <textarea
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="Örn: Akdeniz manzaralı havuz, altın saat ışığı, minimalist peyzaj..."
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
            disabled={!prompt.trim()}
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
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            </svg>
            Oluştur
          </button>
        </>
      )}
    </div>
  );
};
