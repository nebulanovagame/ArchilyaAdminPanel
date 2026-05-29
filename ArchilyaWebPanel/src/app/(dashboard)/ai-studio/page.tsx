"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { useAiStudioState } from "./hooks/use-ai-studio-state";
import { AiStudioSettingsProvider } from "./hooks/use-ai-studio-settings";
import { TOOLS } from "./constants";
import { deriveProcessingStep, deriveCanvasState } from "./utils";
import { staggerContainer, fadeInUp } from "./lib/animation-variants";
import type { PromptHistoryEntry, ToolConfig } from "./types";

import AiStudioToolRail from "./components/ai-studio-tool-rail";
import AiStudioCanvas from "./components/ai-studio-canvas";
import AiStudioSettingsPanel from "./components/ai-studio-settings-panel";
import AiStudioGenerateBar from "./components/ai-studio-generate-bar";
import AiStudioMobileSettings from "./components/ai-studio-mobile-settings";
import AiStudioMobileSession from "./components/ai-studio-mobile-session";
import AiStudioSessionPanel from "./components/ai-studio-session-panel";

const COMPLETION_SHOW_DURATION_MS = 900;

function AiStudioPageInner() {
  const t = useTranslations("dashboard.aiStudio");
  const planT = useTranslations("dashboard.subscription.plans");
  const {
    credits,
    state,
    refs,
    computed,
    job,
    actions,
    setters,
    result,
    fileInput,
  } = useAiStudioState();
  const creditsPlan = (credits as { plan?: string }).plan;

  // Processing step computation based on active job status
  const processingStep = useMemo(
    () => deriveProcessingStep(state.submittingJob, job.activeJob),
    [state.submittingJob, job.activeJob],
  );

  // ── Progress completion hold ────────────────────────────────
  // Hold the "processing" state briefly at 100% so the user sees
  // completion before the result view replaces it.
  const [showCompletion, setShowCompletion] = useState(false);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingToolSwitch, setPendingToolSwitch] = useState<ToolConfig | null>(null);
  // Start false on both server and client to avoid hydration mismatch.
  // Real value is set asynchronously in useEffect after mount.
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  const firstVisitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipToolSwitchConfirmRef = useRef(false);

  // Reset "don't ask again" on unmount so it's truly session-scoped
  useEffect(() => {
    return () => {
      skipToolSwitchConfirmRef.current = false;
    };
  }, []);

  // React 19: avoid synchronous setState in effect body — use setTimeout
  // to defer the localStorage read past the effect boundary.
  useEffect(() => {
    firstVisitTimerRef.current = setTimeout(() => {
      const hasVisited = localStorage.getItem("archilya:ai-studio:first-visit") === "true";
      if (!hasVisited) {
        setIsFirstVisit(true);
      }
    }, 0);
    return () => {
      if (firstVisitTimerRef.current) clearTimeout(firstVisitTimerRef.current);
    };
  }, []);
  const handleDismissFirstVisit = useCallback(() => {
    setIsFirstVisit(false);
    localStorage.setItem("archilya:ai-studio:first-visit", "true");
  }, []);
  const shouldRestoreResultAfterToolSwitchRef = useRef(false);

  const hasVisibleResult = Boolean(state.resultImage || state.resultText);
  const hasToolSwitchContext = computed.hasPrimarySource || hasVisibleResult;
  const lastResultToolLabel = state.resultMeta?.toolLabel || (computed.visibleTool ? t(`tools.${computed.visibleTool.id}.label`) : null);

  useEffect(() => {
    // When activeJobId becomes null (tool switch / clear), immediately
    // reset completion hold — don't wait for next processingStep change.
    // Also reset when jobFailureMessage is set — the job completed with an
    // error and we must NOT hold the processing state any longer.
    if (!state.activeJobId || state.jobFailureMessage) {
      if (showCompletion) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowCompletion(false);
      }
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
      return;
    }

    if (processingStep === 4 && !showCompletion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCompletion(true);
      const timer = setTimeout(() => setShowCompletion(false), COMPLETION_SHOW_DURATION_MS);
      completionTimerRef.current = timer;
      return () => {
        clearTimeout(timer);
        completionTimerRef.current = null;
      };
    }
    if (processingStep < 4 && showCompletion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCompletion(false);
      if (completionTimerRef.current) {
        clearTimeout(completionTimerRef.current);
        completionTimerRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingStep, state.activeJobId, state.jobFailureMessage]);

  // ── Safety timeout: force-exit processing if step 4 lingers without result ──
  // If processingStep stays at 4 ("Önizleme hazırlanıyor") for > 15 s with no
  // resultImage/resultText and no jobFailureMessage, the terminal handler failed
  // to set any state. Force-set a failure message so the canvas override releases
  // and the user sees an error instead of an infinite spinner.
  const step4StuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (processingStep !== 4 || state.resultImage || state.resultText || state.jobFailureMessage) {
      if (step4StuckTimerRef.current) {
        clearTimeout(step4StuckTimerRef.current);
        step4StuckTimerRef.current = null;
      }
      return;
    }

    step4StuckTimerRef.current = setTimeout(() => {
      if (typeof window !== "undefined") {
        console.warn(
          "[ai-studio] Processing step 4 stuck > 15s with no result. " +
          "Terminal handler failed to populate resultImage or jobFailureMessage. " +
          "Check backend result field names in mapAiStudioJobSnapshot.",
        );
      }
      setters.setJobFailureMessage(
        "İşlem zaman aşımına uğradı. Sonuç alınamadı. Lütfen tekrar deneyin.",
      );
    }, 15_000);

    return () => {
      if (step4StuckTimerRef.current) {
        clearTimeout(step4StuckTimerRef.current);
        step4StuckTimerRef.current = null;
      }
    };
  }, [processingStep, state.resultImage, state.resultText, state.jobFailureMessage, setters]);

  useEffect(() => {
    if (!shouldRestoreResultAfterToolSwitchRef.current || !result.hasHiddenResult) {
      return;
    }

    actions.restoreLastResult();
    shouldRestoreResultAfterToolSwitchRef.current = false;
  }, [actions, result.hasHiddenResult]);

  // Base canvas state (before completion hold override)
  const baseCanvasState = useMemo(
    () => deriveCanvasState({
      selectedTool: state.selectedTool,
      generating: computed.generating,
      hasPrimarySource: computed.hasPrimarySource,
      hasResultImage: !!state.resultImage,
      hasResultText: !!state.resultText,
    }),
    [state.selectedTool, computed.generating, computed.hasPrimarySource, state.resultImage, state.resultText],
  );

  // Override canvas state to "processing" when:
  // 1. Holding at 100% completion (showCompletion timer active), OR
  // 2. Job just completed but result image hasn't arrived yet (prevent preview flash)
  //
  // ⚠️ Guard: if jobFailureMessage is set (e.g. completed-but-no-result fallback),
  // do NOT force processing — let the UI show the error state via baseCanvasState.
  const canvasState = !state.jobFailureMessage
    && (showCompletion || (processingStep === 4 && !state.resultImage && !state.resultText))
    && processingStep === 4
    ? "processing"
    : baseCanvasState;

  // PDF files: hasPrimarySource is true but refImagePreview is null (no image to preview).
  // Force "upload" state so ReferenceUploader shows its PDF info card instead of a blank canvas.
  const resolvedCanvasState = canvasState === "preview" && !state.refImagePreview
    ? "upload"
    : canvasState;

  // Workflow chaining actions — auto-use current result as primary source
  const handleRevise = useCallback(() => {
    const reviseTool = TOOLS.find((t) => t.id === "sceneedit");
    if (reviseTool) {
      actions.useResultAsPrimaryScene();
      actions.selectTool(reviseTool);
    }
  }, [actions]);

  const handleReviseWithType = useCallback((revisionType: string) => {
    const reviseTool = TOOLS.find((t) => t.id === "sceneedit");
    if (reviseTool) {
      actions.useResultAsPrimaryScene();
      setters.setRevisionType(revisionType);
      actions.selectTool(reviseTool);
    }
  }, [actions, setters]);

  const handleReviseWithNote = useCallback((note: string) => {
    const reviseTool = TOOLS.find((t) => t.id === "sceneedit");
    if (reviseTool) {
      actions.useResultAsPrimaryScene();
      setters.setExtraNote(note);
      setters.setRevisionType("general");
      actions.selectTool(reviseTool);
    }
  }, [actions, setters]);

  const handleMultiAngle = useCallback(() => {
    const multiAngleTool = TOOLS.find((t) => t.id === "multi-angle");
    if (multiAngleTool) {
      actions.useResultAsPrimaryScene();
      actions.selectTool(multiAngleTool);
    }
  }, [actions]);

  const handleAnalyze = useCallback(() => {
    const analysisTool = TOOLS.find((t) => t.id === "analysis");
    if (analysisTool) actions.selectTool(analysisTool);
  }, [actions]);

  const handleApplyPromptHistory = useCallback(
    (entry: PromptHistoryEntry) => {
      actions.applyPromptHistory(entry);
      setters.setStyle(entry.style);
      setters.setExtraNote(entry.extraNote);
      if (entry.sceneEditMode) {
        setters.setSceneEditMode(entry.sceneEditMode);
      }
    },
    [actions, setters],
  );

  const finalizeToolSwitch = useCallback(
    (tool: ToolConfig, options?: { preserveResult?: boolean }) => {
      const shouldPreserveResult = options?.preserveResult && hasVisibleResult;

      setPendingToolSwitch(null);

      if (shouldPreserveResult) {
        result.hideResult();
        shouldRestoreResultAfterToolSwitchRef.current = true;
        actions.selectTool(tool);
      } else {
        // Single-transition clear + switch (avoids double render lag)
        actions.switchTool(tool);
      }

      toast.success(t("toolSwitchResetToast"));
    },
    [actions, hasVisibleResult, result, t],
  );

  const handleToolSelectionRequest = useCallback(
    (tool: ToolConfig) => {
      if (state.selectedTool?.id === tool.id) {
        setPendingToolSwitch(null);
        return;
      }

      if (!hasToolSwitchContext || skipToolSwitchConfirmRef.current) {
        // No context → safe to do a full clear+switch in one transition
        actions.switchTool(tool);
        return;
      }

      setPendingToolSwitch(tool);
    },
    [actions, hasToolSwitchContext, state.selectedTool],
  );

  return (
      <div className="mx-auto max-w-[1600px] p-3 md:p-4 xl:px-6 xl:py-5 pb-20 md:pb-5">
      {/* Mobile/Tablet: Horizontal Tool Chips (hidden on xl+) */}
      <div className="relative xl:hidden mb-3 -mx-3">
        <div className="mb-2 flex items-center gap-2 px-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-gray-500">
            {t("mobileToolLabel")}
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-white/[0.08] to-transparent" />
        </div>
        <div className="overflow-x-auto px-3" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <div className="flex gap-2 min-w-max pb-1">
            {TOOLS.map((tool) => {
              const Icon = tool.icon;
              const isActive = state.selectedTool?.id === tool.id;
              const toolLabel = t(`tools.${tool.id}.label`);
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (!computed.hasActiveJobInFlight) handleToolSelectionRequest(tool);
                  }}
                  disabled={computed.hasActiveJobInFlight}
                  className={`flex items-center gap-2 rounded-sm border font-bold uppercase tracking-wider whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? `${tool.accentBg} ${tool.accentBorder} ${tool.accentColor} px-3.5 py-2.5 text-[10px] shadow-[0_0_18px_rgba(198,168,124,0.08)]`
                      : tool.isSignature
                        ? "bg-[#0d0f13] border-primary/10 text-gray-400 hover:border-primary/30 hover:text-white px-3 py-2 text-[9px]"
                        : "bg-[#0d0f13] border-white/[0.06] text-gray-500 hover:border-white/[0.15] hover:text-gray-400 px-3 py-2 text-[9px]"
                  } ${isActive && tool.isSignature ? "border-2 bg-primary/8 border-primary/20 text-primary border-l-2 border-l-primary/40" : ""} ${computed.hasActiveJobInFlight ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className={`flex flex-shrink-0 items-center justify-center rounded-sm ${isActive ? "h-6 w-6 bg-white/5" : "h-5 w-5 bg-white/[0.03]"}`}>
                    <Icon className={`${isActive ? "w-3.5 h-3.5" : "w-3 h-3"} flex-shrink-0`} />
                  </span>
                  <span className="max-w-[104px] truncate">{toolLabel}</span>
                  <span className="rounded-sm bg-white/[0.04] px-1.5 py-0.5 text-[8px] opacity-70">{tool.credit}</span>
                  {tool.isSignature && isActive && (
                    <span className="w-1 h-1 rounded-full bg-primary shadow-[0_0_6px_rgba(198,168,124,0.4)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {/* Right fade gradient hint for scrollability */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#0a0c10] via-[#0a0c10]/80 to-transparent" />
      </div>

      {/* 3-Column Layout */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)_370px]"
      >
        {/* LEFT: Tool Rail (hidden on mobile/tablet) */}
        <motion.div variants={fadeInUp} className="hidden xl:block xl:sticky xl:top-20 self-start">
          <AiStudioToolRail
            selectedTool={state.selectedTool}
            onSelectTool={handleToolSelectionRequest}
            hasActiveJobInFlight={computed.hasActiveJobInFlight}
          />
          <div className="mt-5">
            <AiStudioSessionPanel
              promptHistoryByTool={state.promptHistoryByTool}
              hasHiddenResult={result.hasHiddenResult}
              lastResultToolLabel={lastResultToolLabel}
              activeJobId={state.activeJobId}
              resultImage={result.resultImage}
              resultText={result.resultText}
              onApplyPromptHistory={handleApplyPromptHistory}
              onRestoreLastResult={result.restoreLastResult}
            />
          </div>
        </motion.div>

        {/* CENTER: Canvas / Workspace */}
        <motion.div variants={fadeInUp} className="min-w-0">
            {pendingToolSwitch && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="mb-3 rounded-sm border border-white/[0.08] bg-[#0a0c10]/95 px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.22)] backdrop-blur-sm"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p className="text-xs text-white/80">
                    {t("toolSwitchConfirmMessage")}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingToolSwitch(null)}
                      className="rounded-sm border border-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-white/70 transition hover:border-white/[0.14] hover:text-white"
                    >
                      {t("toolSwitchCancel")}
                    </button>
                    {hasVisibleResult && (
                      <button
                        type="button"
                        onClick={() => finalizeToolSwitch(pendingToolSwitch, { preserveResult: true })}
                        className="rounded-sm border border-primary/20 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition hover:border-primary/35 hover:bg-primary/15"
                      >
                        {t("toolSwitchKeepResult")}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => finalizeToolSwitch(pendingToolSwitch)}
                      className="rounded-sm border border-primary/30 bg-primary px-3 py-1.5 text-[11px] font-semibold text-black transition hover:bg-primary/90"
                    >
                      {t("toolSwitchContinue")}
                    </button>
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      skipToolSwitchConfirmRef.current = true;
                      setPendingToolSwitch(null);
                    }}
                    className="text-[8px] text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {t("toolSwitchDontAskAgain")}
                  </button>
                </div>
              </motion.div>
            )}

           <AiStudioCanvas
            /* Sub-hook instances for smart component composition */
            result={result}
            /* Derived UI state */
            canvasState={resolvedCanvasState}
            processingStep={processingStep}
            visibleTool={computed.visibleTool}
            fileInput={fileInput}
            /* Credits */
            credits={credits.credits}
            isFirstVisit={isFirstVisit}
            onDismissFirstVisit={handleDismissFirstVisit}
            planLabel={creditsPlan ? planT(`${creditsPlan}.name`) : undefined}
            remainingCredits={credits.credits}
            /* Job status */
            activeJobId={state.activeJobId}
             activeJob={job.activeJob}
             submittingJob={state.submittingJob}
             jobFailureMessage={state.jobFailureMessage}
             saving={state.saving}
             sharing={state.sharing}
             generating={computed.generating}
            tools={TOOLS}
            /* Coordination callbacks (page-level orchestration) */
            onSelectTool={handleToolSelectionRequest}
            onClear={actions.clearRef}
            onUseAsPrimary={actions.useResultAsPrimaryScene}
             onRetry={() => void actions.handleGenerate({ generationVariant: "retry" })}
             onVariation={actions.runVariation}
             onRevise={handleRevise}
            onReviseWithType={handleReviseWithType}
            onReviseWithNote={handleReviseWithNote}
            onMultiAngle={handleMultiAngle}
            onAnalyze={handleAnalyze}
            onFeedback={actions.handleFeedback}
           />
        </motion.div>

        {/* RIGHT: Settings Panel */}
        {state.selectedTool && (
          <motion.div variants={fadeInUp} className="lg:sticky lg:top-20 self-start lg:col-span-full xl:col-span-1">
            <div className="bg-[#0a0c10]/95 backdrop-blur-sm border border-white/[0.06] rounded-sm p-4 max-h-[calc(100vh-10rem)] flex flex-col">
              <AiStudioSettingsPanel
                selectedTool={state.selectedTool}
                sceneReferences={state.sceneReferences}
                onAddSceneReference={actions.appendSceneReference}
                onRemoveSceneReference={actions.removeSceneReference}
                sceneReferenceInputRef={refs.sceneReferenceInputRef}
                hasPrimarySource={computed.hasPrimarySource}
                hasRequiredSceneReferences={computed.hasRequiredSceneReferences}
                generating={computed.generating}
                credits={credits.credits}
                isFreePlan={creditsPlan === "free" || creditsPlan === "inactive"}
                hasEnoughCredits={credits.hasEnough}
                onGenerate={() => void actions.handleGenerate()}
              />
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Mobile Sticky Generate Bar + Settings */}
      <AnimatePresence>
        {state.selectedTool && (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="fixed bottom-0 left-0 right-0 z-50 xl:hidden border-t border-white/[0.06] bg-[#0a0c10]/95 backdrop-blur-md px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <AiStudioGenerateBar
                  selectedTool={state.selectedTool}
                  canGenerate={computed.hasPrimarySource && computed.hasRequiredSceneReferences && (credits.hasEnough(state.selectedTool.credit) ?? true)}
                  generating={computed.generating}
                  credits={credits.credits}
                  hasEnoughCredits={credits.hasEnough}
                  onGenerate={() => void actions.handleGenerate()}
                  variant="mobile"
                />
              </div>
              <AiStudioMobileSession
                promptHistoryByTool={state.promptHistoryByTool}
                hasHiddenResult={result.hasHiddenResult}
                lastResultToolLabel={lastResultToolLabel}
                activeJobId={state.activeJobId}
                resultImage={state.resultImage}
                resultText={state.resultText}
                onApplyPromptHistory={handleApplyPromptHistory}
                onRestoreLastResult={result.restoreLastResult}
              />
              <AiStudioMobileSettings
                selectedTool={state.selectedTool}
                hasHiddenResult={result.hasHiddenResult}
                lastResultToolLabel={lastResultToolLabel}
                onAddSceneReference={actions.appendSceneReference}
                onRemoveSceneReference={actions.removeSceneReference}
                sceneReferences={state.sceneReferences}
                sceneReferenceInputRef={refs.sceneReferenceInputRef}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
  );
}

export default function AiStudioPage() {
  return (
    <AiStudioSettingsProvider>
      <AiStudioPageInner />
    </AiStudioSettingsProvider>
  );
}
