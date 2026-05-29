"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { fadeInDown, scaleIn, fadeIn } from "../lib/animation-variants";
import type { ToolConfig } from "../types";
import type { AiStudioJobFeedback } from "@/lib/ai-studio/service";
import type { UseAiStudioFileInputReturn } from "../hooks/use-ai-studio-file-input";
import type { UseAiStudioResultReturn } from "../hooks/use-ai-studio-result";
import { Eye } from "lucide-react";
import AiStudioWelcomeState from "./ai-studio-welcome-state";
import AiStudioPreviewState from "./ai-studio-preview-state";
import ReferenceUploader from "./reference-uploader";
import AiStudioProcessingState from "./ai-studio-processing-state";
import ImageResultViewer from "./image-result-viewer";
import ResultCard from "./result-card";
import JobStatusPanel from "./job-status-panel";

interface AiStudioCanvasProps {
  // Sub-hook instances (smart composition)
  result: UseAiStudioResultReturn;
  credits: number | null;
  isFirstVisit?: boolean;
  onDismissFirstVisit?: () => void;
  planLabel?: string;
  remainingCredits?: number | null;

  // Derived UI state
  canvasState: "welcome" | "upload" | "preview" | "processing" | "result" | "result-text";
  processingStep: number;
  visibleTool: ToolConfig | null;

  fileInput: UseAiStudioFileInputReturn;

  // Job status (for JobStatusPanel)
  activeJobId: string | null;
  activeJob: { status: string; progressMessage?: string; error?: { message?: string } | null; exists: boolean };
  submittingJob: boolean;
  jobFailureMessage: string | null;
  saving: boolean;
  sharing: boolean;
  generating: boolean;
  tools: readonly ToolConfig[];

  // Coordination callbacks (page-level orchestration)
  onSelectTool: (tool: ToolConfig) => void;
  onClear: () => void;
  onUseAsPrimary: () => void;
  onRetry: () => void;
  onVariation: () => void;
  onRevise: () => void;
  onReviseWithType: (revisionType: string) => void;
  onReviseWithNote: (note: string) => void;
  onMultiAngle: () => void;
  onAnalyze: () => void;
  onFeedback: (feedback: AiStudioJobFeedback) => void;
}

type WorkflowBreadcrumbStep = "render" | "revision" | "analysis";

const WORKFLOW_BREADCRUMB: Array<{ id: WorkflowBreadcrumbStep; label: string }> = [
  { id: "render", label: "Render" },
  { id: "revision", label: "Revizyon" },
  { id: "analysis", label: "Analiz" },
];

function getCurrentWorkflowStep(tool: ToolConfig | null): WorkflowBreadcrumbStep {
  if (tool?.id === "analysis") {
    return "analysis";
  }

  if (tool?.id === "sceneedit") {
    return "revision";
  }

  return "render";
}

function AiStudioCanvas({
  // Sub-hook
  result,
  credits,
  isFirstVisit,
  onDismissFirstVisit,
  planLabel,
  remainingCredits,
  // Derived UI state
  canvasState,
  processingStep,
  visibleTool,
  fileInput,
  // Job status
  activeJobId,
  activeJob,
  submittingJob,
  jobFailureMessage,
  saving,
  sharing,
  generating,
  tools,
  // Coordination callbacks
  onSelectTool,
  onClear,
  onUseAsPrimary,
  onRetry,
  onVariation,
  onRevise,
  onReviseWithType,
  onReviseWithNote,
  onMultiAngle,
  onAnalyze,
  onFeedback,
}: AiStudioCanvasProps) {
  const t = useTranslations("dashboard.aiStudio");
  const hasVisibleResult =
    (canvasState === "result" && Boolean(result.resultImage)) ||
    (canvasState === "result-text" && Boolean(result.resultText));
  const currentWorkflowStep = getCurrentWorkflowStep(visibleTool);
  const hiddenResultBanner = result.hasHiddenResult ? (
    <div className="flex items-start justify-between gap-3 rounded-sm border border-amber-300/15 bg-amber-400/8 p-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm border border-amber-300/15 bg-amber-400/10">
          <Eye className="h-3 w-3 text-amber-300" />
        </div>
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 font-sans">
            {t("sessionHiddenResult")}
          </p>
          <p className="text-[10px] text-gray-300 font-sans leading-relaxed">
            {t("hiddenResultAvailable")}
          </p>
        </div>
      </div>
      <button
        onClick={result.restoreLastResult}
        className="rounded-sm border border-amber-300/20 bg-amber-400/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-300 transition-all hover:border-amber-300/35 hover:bg-amber-400/15"
      >
        {t("sessionRestore")}
      </button>
    </div>
  ) : null;

  if (!visibleTool) {
    return (
      <div className="min-h-[560px] border border-white/[0.06] rounded-sm bg-[#0a0c10] relative overflow-hidden">
        {hiddenResultBanner && <div className="absolute left-4 right-4 top-4 z-20">{hiddenResultBanner}</div>}
        <AiStudioWelcomeState
          onSelectTool={onSelectTool}
          tools={tools}
          isFirstVisit={isFirstVisit}
          onDismissFirstVisit={onDismissFirstVisit}
          planLabel={planLabel}
          remainingCredits={remainingCredits}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[480px]">
      {/* Canvas header — always visible, outside AnimatePresence to avoid mode="wait" multi-child warning */}
      <motion.div
        key="canvas-header"
        variants={fadeInDown}
        initial="hidden"
        animate="visible"
        className="mb-5 flex items-center gap-3"
      >
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-sm border ${visibleTool.accentBg} ${visibleTool.accentBorder}`}
        >
          <visibleTool.icon
            className={`h-4 w-4 ${visibleTool.accentColor}`}
          />
        </div>
        <h2 className="text-base font-serif text-white italic">
          {t(`tools.${visibleTool.id}.label`)}
        </h2>
      </motion.div>

      <AnimatePresence mode="popLayout">
        {hasVisibleResult && (
          <motion.div
            key="workflow-breadcrumb"
            variants={fadeInDown}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.05 } }}
            className="mb-3 flex items-center gap-2 rounded-sm border border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[9px] uppercase tracking-[0.18em] text-gray-600"
          >
            {WORKFLOW_BREADCRUMB.map((step, index) => {
              const isActive = step.id === currentWorkflowStep;

              return (
                <div key={step.id} className="flex items-center gap-2">
                  <span
                    className={
                      isActive
                        ? "font-bold text-primary"
                        : "font-medium text-gray-600"
                    }
                  >
                    {step.label}
                  </span>
                  {index < WORKFLOW_BREADCRUMB.length - 1 && (
                    <span className="text-gray-700">→</span>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Canvas body — 5 states */}
        {canvasState === "upload" && (
          <motion.div
            key="upload"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.05 } }}
          >
              <div className="space-y-3">
                {hiddenResultBanner}
              <ReferenceUploader
               refImageFile={fileInput.refImageFile}
               refImagePreview={fileInput.refImagePreview}
                primaryDropActive={fileInput.primaryDropActive}
                toolId={visibleTool?.id}
                toolLabel={visibleTool ? t(`tools.${visibleTool.id}.label`) : undefined}
                isProcessing={Boolean(fileInput.refImageFile && !fileInput.refImagePreview)}
                fileInputRef={fileInput.fileInputRef}
                onFileSelect={fileInput.handlePrimaryFileSelection}
                onClear={onClear}
                 onDrop={fileInput.handlePrimaryDrop}
                onDragOver={fileInput.onDragOver}
                onDragLeave={fileInput.onDragLeave}
              />
              <div className="flex items-center gap-2 px-3 py-2 text-[9px] text-gray-600/70 font-sans">
                <span className="rounded-full w-1 h-1 bg-gray-600/40" />
                Bir görsel yükleyin
                <span className="text-gray-700">→</span>
                Sağ panelde ayarları yapın
                <span className="text-gray-700">→</span>
                Generate butonuna basın
              </div>
              </div>
           </motion.div>
        )}

        {canvasState === "preview" && fileInput.refImagePreview && (
          <motion.div
            key="preview"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.05 } }}
          >
              <div className="space-y-3">
                {hiddenResultBanner}
              <AiStudioPreviewState
                refImagePreview={fileInput.refImagePreview}
                onClear={onClear}
              />
              </div>
           </motion.div>
        )}

        {canvasState === "processing" && (
          <motion.div
            key="processing"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.05 } }}
            className="rounded-sm border border-white/[0.06] bg-[#0a0c10]"
          >
            <AiStudioProcessingState currentStep={processingStep} visibleTool={visibleTool} />
            <JobStatusPanel
              activeJobId={activeJobId}
              visibleTool={visibleTool}
              activeJob={activeJob}
              submittingJob={submittingJob}
              jobFailureMessage={jobFailureMessage}
              onRetry={onRetry}
            />
          </motion.div>
        )}

        {canvasState === "result" && result.resultImage && (
          <motion.div
            key="result"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.05 } }}
          >
            <ImageResultViewer
              result={result}
               refImagePreview={fileInput.refImagePreview}
               visibleTool={visibleTool}
              saving={saving}
               sharing={sharing}
               generating={generating}
               credits={credits}
              onUseAsPrimary={onUseAsPrimary}
              onRetry={onRetry}
              onVariation={onVariation}
              onRevise={onRevise}
              onReviseWithType={onReviseWithType}
              onReviseWithNote={onReviseWithNote}
              onMultiAngle={onMultiAngle}
              onAnalyze={onAnalyze}
              onFeedback={onFeedback}
            />
          </motion.div>
        )}

        {canvasState === "result-text" && result.resultText && (
          <motion.div
            key="result-text"
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, transition: { duration: 0.05 } }}
          >
            <ResultCard
              text={result.resultText}
              onClose={() => result.hideResult()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AiStudioCanvas;
