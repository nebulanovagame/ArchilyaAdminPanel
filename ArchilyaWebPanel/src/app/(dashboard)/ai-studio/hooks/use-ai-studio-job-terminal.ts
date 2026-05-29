"use client";

import { useEffect, useRef } from "react";
import toast from "react-hot-toast";

import type { AiStudioJobStatus } from "@/lib/ai-studio/job-contract";
import { isAiStudioJobTerminal } from "@/lib/ai-studio/job-contract";
import { logAiGenerationSuccess } from "@/lib/analytics/events";

import type { ToolConfig, ActiveJobDraft, PromptHistoryEntry, ResultMeta } from "../types";
import type { ResultBridgingRef } from "./use-ai-studio-job-lifecycle";
import { toIsoString } from "../utils";

type TerminalJob = {
  status: AiStudioJobStatus;
  exists: boolean;
  toolId?: string;
  style?: string;
  sceneEditMode?: string;
  extraNote?: string;
  outputType?: "text" | "image";
  sourceImageUri?: string;
  generationVariant?: string;
  error?: { message?: string } | null;
  result?: { imageUrl?: string; mimeType?: string; text?: string };
  completedAt?: string | unknown;
  updatedAt?: string | unknown;
  createdAt?: string | unknown;
  referenceCount?: number;
};

export function useAiStudioJobTerminal(
  activeJobId: string | null,
  activeJob: TerminalJob,
  activeJobTool: ToolConfig | null,
  selectedTool: ToolConfig | null,
  activeJobDraft: ActiveJobDraft | null,
  getToolLabel: (tool: ToolConfig) => string,
  getSuccessMessage: (tool: ToolConfig) => string,
  addPromptHistoryEntry: (entry: Partial<PromptHistoryEntry>) => void,
  bridgingRef: React.MutableRefObject<ResultBridgingRef>,
  setJobFailureMessage: (msg: string | null) => void,
  t: (key: string, params?: Record<string, string | number | Date>) => string,
  notify: (options: { title: string; body: string; tag: string }) => Promise<void>,
) {
  const observedJobStatusRef = useRef("");
  const handledTerminalJobRef = useRef("");

  useEffect(() => {
    if (!activeJobId) {
      observedJobStatusRef.current = "";
      handledTerminalJobRef.current = "";
    }
  }, [activeJobId]);

  useEffect(() => {
    if (!activeJobId || !activeJob.exists) return;
    const previousObservedStatus = observedJobStatusRef.current;
    observedJobStatusRef.current = activeJob.status;
    const finalizedTool = activeJobTool || selectedTool;
    if (!finalizedTool || !isAiStudioJobTerminal(activeJob)) return;

    const handledKey = `${activeJobId}:${activeJob.status}`;
    if (handledTerminalJobRef.current === handledKey) return;
    handledTerminalJobRef.current = handledKey;

    // Access ref values inside the effect, not during render
    const {
      setResultMeta,
      setCompareSplit,
      setResultText,
      setResultImage,
      setRevisionSteps,
      setRevisionCursor,
    } = bridgingRef.current;

    const metadata: ResultMeta = {
      id: activeJobId,
      toolId: finalizedTool.id,
      toolLabel: getToolLabel(finalizedTool),
      outputType: activeJob.outputType || finalizedTool.outputType,
      style: activeJob.style || activeJobDraft?.style || "",
      sceneEditMode: activeJob.sceneEditMode || activeJobDraft?.sceneEditMode || "",
      referenceCount: activeJob.referenceCount || activeJobDraft?.referenceCount || 0,
      extraNote: activeJob.extraNote || activeJobDraft?.extraNote || "",
      generationVariant: activeJob.generationVariant || activeJobDraft?.generationVariant || "default",
      createdAt: toIsoString(activeJob.completedAt || activeJob.updatedAt || activeJob.createdAt),
    };

    // Execute terminal result callbacks synchronously.
    // Previously wrapped in setTimeout(0) for render batching, but React 18's
    // automatic batching handles this without explicit deferral.
    setResultMeta(metadata);
    setCompareSplit(50);
    const shouldNotify = previousObservedStatus !== ""
      && previousObservedStatus !== "completed"
      && previousObservedStatus !== "failed"
      && previousObservedStatus !== "cancelled"
      && document.visibilityState === "hidden";

    if (activeJob.status === "completed") {
      const successMessage = getSuccessMessage(finalizedTool);
      setJobFailureMessage(null);
      if (activeJob.outputType === "text") {
        setResultText(activeJob.result?.text || null);
        setResultImage(null);
        setRevisionSteps([]);
        setRevisionCursor(-1);
      } else if (activeJob.result?.imageUrl) {
        const completedImage = { src: activeJob.result.imageUrl, mimeType: activeJob.result.mimeType || "image/png" };
        setResultText(null);
        setResultImage(completedImage);
        setRevisionSteps([{ src: completedImage.src, mimeType: completedImage.mimeType, meta: metadata }]);
        setRevisionCursor(0);
      } else {
        // ═══════════════════════════════════════════════════════════════════
        // Job completed but result image URL is empty — the backend may have
        // written the result to a field not covered by mapAiStudioJobSnapshot,
        // or the async processing pipeline failed to populate the result.
        //
        // Without this fallback, the UI hangs forever at step 5
        // ("Önizleme hazırlanıyor") because resultImage stays null while
        // deriveProcessingStep returns 4 (completed). The canvas override
        // in page.tsx forces "processing" state indefinitely.
        // ═══════════════════════════════════════════════════════════════════
        const fallbackMsg =
          t("dashboard.aiStudio.jobCompletedNoResult", {
            tool: getToolLabel(finalizedTool),
          }) ||
          activeJob.error?.message ||
          `"${getToolLabel(finalizedTool)}" tamamlandı ancak sonuç alınamadı. Lütfen tekrar deneyin.`;
        setResultText(null);
        setResultImage(null);
        setRevisionSteps([]);
        setRevisionCursor(-1);
        setJobFailureMessage(fallbackMsg);
        toast.error(fallbackMsg, { duration: 9000 });
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[ai-studio] Job completed with empty result image URL",
            { jobId: activeJobId, toolId: finalizedTool.id, outputType: activeJob.outputType },
          );
        }
        addPromptHistoryEntry({ ...metadata, statusLabel: t("dashboard.aiStudio.toolFailure", { tool: getToolLabel(finalizedTool) }) });
        return;
      }
      toast.success(successMessage);
      logAiGenerationSuccess(finalizedTool.id);
      if (shouldNotify) {
        void notify({ title: getToolLabel(finalizedTool), body: successMessage, tag: `ai-studio-job-${activeJobId}` });
      }
      addPromptHistoryEntry({ ...metadata, statusLabel: successMessage });
      return;
    }

    const fallbackMsg = activeJob.error?.message || t("dashboard.aiStudio.jobFailed", { tool: getToolLabel(finalizedTool) });
    setResultText(null);
    setResultImage(null);
    setRevisionSteps([]);
    setRevisionCursor(-1);
    setJobFailureMessage(fallbackMsg);
    toast.error(fallbackMsg, { duration: 9000 });
    if (shouldNotify) {
      void notify({ title: getToolLabel(finalizedTool), body: fallbackMsg, tag: `ai-studio-job-${activeJobId}` });
    }
    addPromptHistoryEntry({ ...metadata, statusLabel: t("dashboard.aiStudio.toolFailure", { tool: getToolLabel(finalizedTool) }) });
  }, [activeJob, activeJobDraft, activeJob.exists, activeJobId, activeJobTool, addPromptHistoryEntry, getSuccessMessage, getToolLabel, notify, selectedTool, t, setJobFailureMessage, bridgingRef]);
}
