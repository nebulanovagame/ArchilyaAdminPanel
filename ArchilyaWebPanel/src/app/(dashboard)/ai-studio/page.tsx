"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import FeatureGate from "@/components/feature-gate";
import type { FeatureFlagName } from "@/lib/feature-flags/config";

import { useAiStudioState } from "./hooks/use-ai-studio-state";

import ToolSidebar from "./components/tool-sidebar";
import ReferenceUploader from "./components/reference-uploader";
import SceneEditor from "./components/scene-editor";
import PromptHistoryList from "./components/prompt-history-list";
import StylePicker from "./components/style-picker";
import ExtraNoteInput from "./components/extra-note-input";
import ResultCard from "./components/result-card";
import JobStatusPanel from "./components/job-status-panel";
import ImageResultViewer from "./components/image-result-viewer";
import PromptTemplates from "./components/prompt-templates";

const BATCH_GENERATION_FLAG: FeatureFlagName = "batchAiGeneration";

export default function AiStudioPage() {
  const t = useTranslations("dashboard.aiStudio");
  const {
    credits,
    state,
    refs,
    computed,
    job,
    actions,
    setters,
  } = useAiStudioState();

  return (
    <div className="mx-auto max-w-[1600px] p-5 md:p-6 xl:px-7 xl:py-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-primary text-[10px] uppercase tracking-[0.3em]">{t("eyebrow")}</p>
            <h1 className="text-3xl font-serif text-white italic">{t("title")}</h1>
          </div>
        </div>
        <p className="mt-3 max-w-3xl text-sm font-sans text-gray-400">
          <span className="text-primary font-bold">Archilya AI</span> {t("subtitle")}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <ToolSidebar
          selectedTool={state.selectedTool}
          onSelectTool={actions.selectTool}
          hasActiveJobInFlight={computed.hasActiveJobInFlight}
        />

        <div className="space-y-4">
          {!state.selectedTool ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border border-dashed border-white/10 rounded-sm flex flex-col items-center justify-center py-24 text-center">
              <Sparkles className="w-12 h-12 text-gray-700 mb-4" />
              <p className="text-gray-500 text-sm font-sans mb-1">{t("selectToolTitle")}</p>
              <p className="text-gray-700 text-xs font-sans">{t("selectToolSubtitle")}</p>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={state.selectedTool.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-sm ${state.selectedTool.bg} border ${state.selectedTool.border} flex items-center justify-center`}>
                    <state.selectedTool.icon className={`w-4 h-4 ${state.selectedTool.color}`} />
                  </div>
                  <h2 className="text-lg font-serif text-white italic">{t(`tools.${state.selectedTool.id}.label`)}</h2>
                </div>

                <ReferenceUploader
                  refImageFile={state.refImageFile}
                  refImagePreview={state.refImagePreview}
                  primaryDropActive={state.primaryDropActive}
                  fileInputRef={refs.fileInputRef}
                  onFileSelect={actions.handlePrimaryFileSelection}
                  onClear={actions.clearRef}
                  onDrop={actions.handlePrimaryDrop}
                  onDragOver={(event) => { event.preventDefault(); setters.setPrimaryDropActive(true); }}
                  onDragLeave={() => setters.setPrimaryDropActive(false)}
                />

                {state.selectedTool.id === "sceneedit" && (
                  <SceneEditor
                    sceneEditMode={state.sceneEditMode}
                    onSceneEditModeChange={setters.setSceneEditMode}
                    sceneReferences={state.sceneReferences}
                    onAddReference={actions.appendSceneReference}
                    onRemoveReference={actions.removeSceneReference}
                    sceneReferenceInputRef={refs.sceneReferenceInputRef}
                  />
                )}

                <PromptHistoryList
                  entries={computed.activePromptHistory}
                  onApply={actions.applyPromptHistory}
                />

                {(state.selectedTool.hasStyle || state.selectedTool.id === "enhance") && (
                  <StylePicker style={state.style} setStyle={setters.setStyle} />
                )}

                <PromptTemplates
                  hasPrimarySource={computed.hasPrimarySource}
                  selectedToolId={state.selectedTool?.id || null}
                  generating={state.generatingPromptInspiration}
                  onGenerateInspiration={() => void actions.handleGeneratePromptInspiration()}
                />

                <ExtraNoteInput
                  value={state.extraNote}
                  onChange={setters.setExtraNote}
                  placeholder={
                    state.selectedTool.id === "analysis" ? t("promptPlaceholder.analysis") :
                    state.selectedTool.id === "img2img" ? t("promptPlaceholder.img2img") :
                    state.selectedTool.id === "enhance" ? t("promptPlaceholder.enhance") :
                    state.selectedTool.id === "sceneedit" ? t("promptPlaceholder.sceneedit") :
                    t("promptPlaceholder.default")
                  }
                />

                <button
                  onClick={() => void actions.handleGenerate()}
                  disabled={computed.generating || !computed.hasPrimarySource || !computed.hasRequiredSceneReferences}
                  className={`w-full flex items-center justify-center gap-3 py-4 rounded-sm text-sm font-bold uppercase tracking-widest transition-all ${computed.generating ? "bg-white/5 text-gray-500 cursor-not-allowed" : `${state.selectedTool.bg} border ${state.selectedTool.border} ${state.selectedTool.color} hover:opacity-90`}`}
                >
                  {computed.generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {computed.visibleTool?.outputType === "image" ? t("imageQueued") : t("analysisQueued")}</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> {state.selectedTool.outputType === "image" ? t("generateImage", { credit: state.selectedTool.credit }) : t("startAnalysis", { credit: state.selectedTool.credit })}</>
                  )}
                </button>

                {!credits.hasEnough(state.selectedTool.credit) && credits.credits !== null && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-400/5 border border-red-400/20 rounded-sm text-xs text-red-300 font-sans">
                    <AlertCircle className="w-4 h-4" />
                    {t("creditRequired", { required: state.selectedTool.credit, available: credits.credits.toLocaleString("tr-TR") })}
                  </div>
                )}

                <JobStatusPanel
                  activeJobId={state.activeJobId}
                  visibleTool={computed.visibleTool}
                  activeJob={job.activeJob}
                  submittingJob={state.submittingJob}
                  jobFailureMessage={state.jobFailureMessage}
                />

                <FeatureGate
                  flagName={BATCH_GENERATION_FLAG}
                  fallback={(
                    <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-4 text-center text-xs text-gray-500">
                      {t("batchComingSoon")}
                    </div>
                  )}
                >
                  <div className="bg-[#0d0f13] border border-white/5 rounded-sm p-4 space-y-3">
                    <div className="text-center space-y-1">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-primary">Beta</p>
                      <h3 className="text-sm font-serif italic text-white">{t("batchTitle")}</h3>
                    </div>
                    <p className="text-xs text-gray-400 text-center font-sans">
                      {t("batchDescription")}
                    </p>
                  </div>
                </FeatureGate>

                <AnimatePresence>
                  {state.resultText && !computed.generating && <ResultCard text={state.resultText} onClose={() => setters.setResultText(null)} />}
                </AnimatePresence>

                <AnimatePresence>
                  {state.resultImage && !computed.generating && computed.visibleTool?.outputType === "image" && (
                    <ImageResultViewer
                      resultImage={state.resultImage}
                      refImagePreview={state.refImagePreview}
                      compareSplit={state.compareSplit}
                      onCompareSplitChange={setters.setCompareSplit}
                      visibleTool={computed.visibleTool}
                      onDownload={actions.handleDownloadCurrentResult}
                      onSave={actions.handleSaveResultToProject}
                      onShare={actions.handleNativeShare}
                      onUseAsPrimary={actions.useResultAsPrimaryScene}
                      onRetry={() => void actions.handleGenerate({ generationVariant: "retry" })}
                      onVariation={actions.runVariation}
                      onUndo={actions.handleUndo}
                      onRedo={actions.handleRedo}
                      canUndo={computed.canUndoRevision}
                      canRedo={computed.canRedoRevision}
                      saving={state.saving}
                      sharing={state.sharing}
                      generating={computed.generating}
                      feedback={job.activeJob.feedback}
                      onFeedback={actions.handleFeedback}
                      onClose={() => setters.setResultImage(null)}
                    />
                  )}
                </AnimatePresence>

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}
