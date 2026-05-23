import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { ImageUploadZone } from './ImageUploadZone';
import { GenerationSkeleton } from './GenerationSkeleton';
import { ResultViewer } from './ResultViewer';
import { PromptTemplatePicker } from './PromptTemplatePicker';
import { AI_TOOLS } from '../../data/aiStudioMockData';
import { useAiSession } from '../../hooks/useAiSession';
import { SCENE_EDIT_TEMPLATES } from '../../ai-studio/promptTemplates';
import { buildSceneEditPrompt } from '../../ai-studio/promptBuilders';
import { saveGeneration } from '../../lib/ai-gallery/storage';

// ── Types ────────────────────────────────────────────────────────────────────

type EditMode = 'place' | 'replace' | 'material-swap' | 'scene-compose' | 'remove';

interface ReferenceItem {
  id: string;
  file: File;
  preview: string;
  label: string;
  note: string;
}

// ── Edit mode config ─────────────────────────────────────────────────────────

const EDIT_MODES: { id: EditMode; label: string; description: string }[] = [
  { id: 'place', label: 'Yerleştir', description: 'Referans objeyi sahneye yerleştir' },
  { id: 'replace', label: 'Değiştir', description: 'Var olan objeyi referansla değiştir' },
  { id: 'material-swap', label: 'Malzeme Değişimi', description: 'Yüzey malzemesini referansla değiştir' },
  { id: 'scene-compose', label: 'Sahne Düzenle', description: 'Tüm referansları sahneye entegre et' },
  { id: 'remove', label: 'Kaldır', description: 'Belirtilen objeleri sahneden kaldır' },
];

const MAX_REFERENCES = 4;

// ── Component ────────────────────────────────────────────────────────────────

export const SceneEditPanel: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<EditMode>('place');
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [extraNote, setExtraNote] = useState('');
  const [showPromptPreview, setShowPromptPreview] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    isGenerating, resultUrl, error,
    startSession, clearSession,
  } = useAiSession({ toolId: 'scene-edit', enabled: true });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Source image ─────────────────────────────────────────────────────────

  const handleSourceFilesDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceImage((e.target?.result as string) || null);
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Reference images ────────────────────────────────────────────────────

  const handleAddReference = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const remaining = MAX_REFERENCES - references.length;
      if (remaining <= 0) return;

      const toAdd: File[] = Array.from(files).slice(0, remaining);
      const newRefs: ReferenceItem[] = [];

      let loaded = 0;
      toAdd.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const preview = (ev.target?.result as string) || '';
          newRefs.push({
            id: `ref-${Date.now()}-${idx}`,
            file,
            preview,
            label: `Referans ${references.length + idx + 1}`,
            note: '',
          });
          loaded++;
          if (loaded === toAdd.length) {
            setReferences((prev) => [...prev, ...newRefs]);
          }
        };
        reader.readAsDataURL(file);
      });

      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [references.length],
  );

  const handleRemoveReference = useCallback((id: string) => {
    setReferences((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const handleUpdateReferenceLabel = useCallback((id: string, label: string) => {
    setReferences((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)));
  }, []);

  const handleUpdateReferenceNote = useCallback((id: string, note: string) => {
    setReferences((prev) => prev.map((r) => (r.id === id ? { ...r, note } : r)));
  }, []);

  const generatedPrompt = useMemo(() => {
    if (!sourceImage) return '';
    return buildSceneEditPrompt({
      editMode: selectedMode,
      references: references.map((r) => ({ type: 'object', label: r.label, note: r.note })),
      extraNote,
    });
  }, [sourceImage, selectedMode, references, extraNote]);

  const sessionPromptText = generatedPrompt || extraNote;

  // ── Generation ──────────────────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    if (references.length === 0) {
      setValidationError('En az bir referans görsel eklemelisiniz.');
      return;
    }
    setValidationError(null);

    await startSession({
      promptText: sessionPromptText,
      sourceImage: sourceImage || undefined,
    });
  }, [references.length, sessionPromptText, sourceImage, startSession]);

  useEffect(() => {
    if (resultUrl) {
      const tool = AI_TOOLS.find((t) => t.id === 'scene-edit');
      void saveGeneration({
        id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        toolId: 'scene-edit',
        toolName: tool?.name || 'Sahne Düzenleme',
        category: tool?.category || 'conversion',
        promptText: sessionPromptText,
        imageUrl: resultUrl,
        sourceImage: sourceImage || undefined,
        createdAt: Date.now(),
        status: 'completed',
        creditsCost: tool?.creditCost ?? 18,
        feedback: null,
      }).catch((saveError) => {
        console.error('Failed to save AI gallery generation:', saveError);
      });
    }
  }, [resultUrl, sessionPromptText, sourceImage]);

  useEffect(() => {
    if (error) {
      console.error('SceneEditPanel error:', error);
    }
  }, [error]);

  const handleReset = useCallback(() => {
    setSourceImage(null);
    setSelectedMode('place');
    setReferences([]);
    setExtraNote('');
    setShowPromptPreview(false);
    setValidationError(null);
    clearSession();
  }, [clearSession]);

  const handleDownload = useCallback(async () => {
    if (!resultUrl) return;
    const result = await window.api.downloadFile(resultUrl, 'archilya-sahne-duzenleme-sonuc.png');
    if (!result.success) {
      console.error('Download failed:', result.error);
    }
  }, [resultUrl]);

  // ── Derived ─────────────────────────────────────────────────────────────

  const activeModeConfig = EDIT_MODES.find((m) => m.id === selectedMode)!;
  const canAddReference = references.length < MAX_REFERENCES;

  // ── Render ──────────────────────────────────────────────────────────────

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
          className="text-violet-400/70"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        <h2 className="font-display text-sm tracking-[0.18em] text-archilya-text uppercase">
          Sahne Düzenleme
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
            Yeni Düzenleme
          </button>
        </div>
      ) : isGenerating ? (
        <GenerationSkeleton text="Sahne düzenleniyor..." />
      ) : (
        <>
          {/* ── Source image upload ──────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
              Temel Render
            </p>
            <ImageUploadZone onFilesDrop={handleSourceFilesDrop} accept="image/*" />
            {sourceImage && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <img
                  src={sourceImage}
                  alt="Temel render"
                  className="w-full h-auto max-h-40 object-contain"
                />
              </div>
            )}
          </div>

          {/* ── Edit mode selection ───────────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
              Düzenleme Modu
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {EDIT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded border text-center transition-all duration-200 ${
                    selectedMode === mode.id
                      ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                      : 'border-white/[0.06] bg-white/[0.03] text-archilya-text-dim hover:border-white/[0.12] hover:text-archilya-text'
                  }`}
                >
                  <span className="text-[10px] font-display tracking-wider">{mode.label}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-archilya-text-dim/60 italic">
              {activeModeConfig.description}
            </p>
          </div>

          {/* ── Reference images ─────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
                Referans Görseller
              </p>
              <span className="text-[9px] font-mono text-archilya-text-dim/40">
                {references.length}/{MAX_REFERENCES}
              </span>
            </div>

            {/* Reference cards */}
            <div className="space-y-2">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 flex gap-3"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 flex-shrink-0 rounded-lg border border-white/[0.06] overflow-hidden bg-black/20">
                    <img
                      src={ref.preview}
                      alt={ref.label}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Inputs */}
                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <input
                      type="text"
                      value={ref.label}
                      onChange={(e) => handleUpdateReferenceLabel(ref.id, e.target.value)}
                      className="w-full bg-black/20 border border-white/[0.06] rounded px-2 py-1 text-[11px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:border-archilya-gold/30 focus:outline-none transition-colors"
                      placeholder="Referans etiketi"
                    />
                    <textarea
                      value={ref.note}
                      onChange={(e) => handleUpdateReferenceNote(ref.id, e.target.value)}
                      placeholder="Not ekle..."
                      rows={2}
                      className="w-full bg-black/20 border border-white/[0.06] rounded px-2 py-1 text-[10px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:border-archilya-gold/30 focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveReference(ref.id)}
                    className="self-start flex-shrink-0 w-6 h-6 flex items-center justify-center rounded border border-white/[0.06] text-archilya-text-dim/40 hover:text-red-400 hover:border-red-400/30 transition-all duration-200"
                    title="Kaldır"
                  >
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
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add reference button */}
            {canAddReference && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAddReference}
                  className="hidden"
                  multiple
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 text-[11px] font-display tracking-[0.15em] uppercase border border-dashed border-white/[0.08] text-archilya-text-dim/50 hover:text-archilya-gold hover:border-archilya-gold/30 rounded transition-all duration-200"
                >
                  + Referans Ekle
                </button>
              </>
            )}
          </div>

          {/* ── Extra note ───────────────────────────────────────────────── */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 space-y-2">
            <label className="text-[10px] font-mono uppercase tracking-widest text-archilya-gold/60">
              Ek Not
            </label>
            <textarea
              value={extraNote}
              onChange={(e) => setExtraNote(e.target.value)}
              placeholder="Ek talimat veya detay..."
              rows={2}
              className="w-full bg-black/20 border border-white/[0.06] rounded-lg px-3 py-2 text-[11px] text-archilya-text placeholder:text-archilya-text-dim/30 focus:border-archilya-gold/30 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* ── Prompt Templates ──────────────────────────────────────────── */}
          <PromptTemplatePicker
            templates={SCENE_EDIT_TEMPLATES}
            onSelect={(text) => setExtraNote((prev) => (prev ? prev + ', ' + text : text))}
          />

          {/* ── Prompt Preview ────────────────────────────────────────────── */}
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

          {/* ── Validation error ──────────────────────────────────────────── */}
          {validationError && (
            <p className="text-[10px] font-mono text-red-400/80 text-center">
              {validationError}
            </p>
          )}

          {/* ── Action button ─────────────────────────────────────────────── */}
          <button
            onClick={handleApply}
            className="w-full py-3 text-xs font-display tracking-[0.2em] uppercase border border-violet-400/40 text-violet-400 hover:bg-violet-400 hover:text-black rounded transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Uygula
          </button>
        </>
      )}
    </div>
  );
};
