"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { useAiStudioJob } from "@/hooks/use-ai-studio-job";
import { useAiStudioJobTerminal } from "./use-ai-studio-job-terminal";
import { createActivityLogEntry } from "@/lib/activity/service";
import { isFeatureEnabled } from "@/lib/feature-flags/config";
import { generatePromptInspiration, queueAiStudioJob } from "@/services/nano-banana-service";
import { saveAiJobFeedback } from "@/lib/ai-studio/service";
import type { PromptContract } from "@/lib/prompt-engine";

import { VARIATION_NOTE_SUFFIX } from "../constants";
import {
  buildToolContract,
  buildToolNote,
  clearStoredActiveJob,
  getFriendlyAIError,
  getToolById,
  persistActiveJob,
  readStoredActiveJob,
  sanitizePromptHistoryEntry,
  sanitizePromptHistoryMap,
} from "../utils";
import { getAiPromptHistorySecure, saveAiPromptHistorySecure } from "@/services/entitlement-service";
import type {
  ActiveJobDraft,
  PromptHistoryEntry,
  ResultImage,
  ResultMeta,
  ResultRevisionStep,
  SceneReference,
  ToolConfig,
} from "../types";
import type { AiStudioJobFeedback } from "@/lib/ai-studio/service";

/** Stable ref bridging terminal events to result state setters in the facade */
export interface ResultBridgingRef {
  setResultMeta: (meta: ResultMeta | null) => void;
  setCompareSplit: (split: number) => void;
  setResultText: (text: string | null) => void;
  setResultImage: (image: ResultImage | null) => void;
  setRevisionSteps: (steps: ResultRevisionStep[]) => void;
  setRevisionCursor: (cursor: number) => void;
}

// ── Context passed by the facade at generate time ──────────
export interface GenerateContext {
  selectedTool: ToolConfig;
  style: string;
  extraNote: string;
  sceneEditMode: string;
  revisionType: string;
  analysisFocus: string[];
  multiAnglePreserve: string[];
  atmosphere: string;
  materialLanguage: string;
  styleStrength: string;
  enhancePreserve: string[];
  scenePreserveAreas: string[];
  planType: string;
  palette: string;
  roomLabels: boolean;
  presentationStyle: string;
  reportTone: string;
  sceneReferences: SceneReference[];
  refImageFile: File | null;
  selectedFileUrl: string;
  refImagePreview: string | null;
  hasPrimarySource: boolean;
  hasRequiredSceneReferences: boolean;
}

/** Restore payload emitted when a restored job is observed */
export interface RestorePayload {
  tool: ToolConfig | null;
  style: string | undefined;
  sceneEditMode: string | undefined;
  extraNote: string | undefined;
  sourceImageUri: string | undefined;
  atmosphere?: string;
  materialLanguage?: string;
  styleStrength?: string;
  planType?: string;
  palette?: string;
  presentationStyle?: string;
  reportTone?: string;
  roomLabels?: boolean;
  analysisFocus?: string[];
  multiAnglePreserve?: string[];
  enhancePreserve?: string[];
  scenePreserveAreas?: string[];
}

export interface JobLifecycleDeps {
  currentUser: { uid: string; email: string | null; name?: string | null } | null;
  ownerName: string;
  credits: number | null;
  hasEnough: (amount: number) => boolean;
  activeWorkspace: { id: string } | null;
  updatePoolStorage: (bytes: number) => Promise<void>;
  getToolLabel: (tool: ToolConfig) => string;
  t: ReturnType<typeof useTranslations>;
  notify: (opts: { title: string; body: string; tag: string }) => Promise<void>;
  bridgingRef: React.MutableRefObject<ResultBridgingRef>;
}

/**
 * useAiStudioJobLifecycle
 *
 * Owns the job submission, polling, and terminal handling lifecycle.
 * - Does NOT own tool selection or settings state
 * - Receives generate context as a parameter to handleGenerate
 * - Emits terminal results via onTerminalResult callback
 */
export function useAiStudioJobLifecycle(deps: JobLifecycleDeps) {
  const { currentUser, hasEnough, activeWorkspace, getToolLabel, notify, bridgingRef } = deps;
  const t = deps.t;
  // ── Job state ──────────────────────────────────────────────
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobDraft, setActiveJobDraft] = useState<ActiveJobDraft | null>(null);
  const [submittingJob, setSubmittingJob] = useState(false);
  const [generatingPromptInspiration, setGeneratingPromptInspiration] = useState(false);
  const [jobFailureMessage, setJobFailureMessage] = useState<string | null>(null);
  const [restorePayload, setRestorePayload] = useState<RestorePayload | null>(null);

  // ── Submission guard (prevents duplicate jobs from rapid clicks) ──
  // Ref-based so it works even before React's async state batching for `submittingJob`.
  const isSubmittingRef = useRef(false);

  // ── Prompt history ─────────────────────────────────────────
  const [promptHistoryByTool, setPromptHistoryByTool] = useState<Record<string, PromptHistoryEntry[]>>({});

  // ── Refs for job restoration tracking ──────────────────────
  const restoredJobRef = useRef<string>("");
  const userModifiedInputRef = useRef(false);

  /** Public method to mark that the user modified input (avoids direct ref mutation from parent). */
  const markInputModified = useCallback(() => {
    userModifiedInputRef.current = true;
  }, []);

  // ── Job observation ────────────────────────────────────────
  const {
    data: activeJob,
    loading: activeJobLoading,
    error: activeJobError,
  } = useAiStudioJob(deps.currentUser?.uid ?? null, activeJobId);

  const activeJobTool = getToolById(activeJob.toolId || activeJobDraft?.toolId || "");

  // ── Prompt history: load on mount ──────────────────────────
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!currentUser) {
        if (mounted) setPromptHistoryByTool({});
        return;
      }
      try {
        const result = await getAiPromptHistorySecure();
        if (!mounted) return;
        setPromptHistoryByTool(sanitizePromptHistoryMap(result.history as Record<string, unknown>));
      } catch {
        if (mounted) setPromptHistoryByTool({});
        if (process.env.NODE_ENV !== "production") {
          console.warn("[ai-studio] Prompt history load failed, starting with empty history");
        }
      }
    };
    void load();
    return () => { mounted = false; };
  }, [currentUser]);

  const addPromptHistoryEntry = useCallback(
    (entry: Partial<PromptHistoryEntry>) => {
      const safeEntry = sanitizePromptHistoryEntry(entry, activeJobTool?.id || "");
      if (!safeEntry) return;

      setPromptHistoryByTool((current) => {
        const toolEntries = Array.isArray(current[safeEntry.toolId]) ? current[safeEntry.toolId] : [];
        return {
          ...current,
          [safeEntry.toolId]: [safeEntry, ...toolEntries.filter((item) => item.id !== safeEntry.id)].slice(0, 8),
        };
      });

      if (!currentUser) return;
      void saveAiPromptHistorySecure(safeEntry.toolId, safeEntry)
        .then((result) => {
          setPromptHistoryByTool((current) => ({
            ...current,
            [safeEntry.toolId]:
              sanitizePromptHistoryMap(result.history as Record<string, unknown>)[safeEntry.toolId] ||
              current[safeEntry.toolId] ||
              [],
          }));
        })
        .catch((error) => {
          // Non-blocking: prompt history save failure doesn't affect user flow.
          // Log for debugging without surfacing to user.
          if (process.env.NODE_ENV !== "production") {
            console.warn("[ai-studio] Prompt history save failed:", error instanceof Error ? error.message : error);
          }
        });
    },
    [currentUser, activeJobTool?.id],
  );

  // ── Job restoration from localStorage ──────────────────────
  useEffect(() => {
    if (!currentUser?.uid) {
      restoredJobRef.current = "";
      const id = window.setTimeout(() => {
        setActiveJobId(null);
        setActiveJobDraft(null);
      }, 0);
      return () => window.clearTimeout(id);
    }

    if (userModifiedInputRef.current) {
      restoredJobRef.current = "";
      return;
    }

    const storedJob = readStoredActiveJob(currentUser.uid);
    if (!storedJob) {
      restoredJobRef.current = "";
      return;
    }

    const storedTool = getToolById(storedJob.toolId);
    const id = window.setTimeout(() => {
      if (userModifiedInputRef.current) {
        restoredJobRef.current = "";
        return;
      }
      setActiveJobId(storedJob.jobId);
      setActiveJobDraft({
        id: storedJob.jobId,
        toolId: storedJob.toolId,
        toolLabel: storedTool ? getToolLabel(storedTool) : storedJob.toolId,
        outputType: storedJob.outputType,
        style: storedJob.style,
        sceneEditMode: storedJob.sceneEditMode,
        referenceCount: 0,
        extraNote: storedJob.extraNote,
        generationVariant: storedJob.generationVariant,
        createdAt: new Date().toISOString(),
        sourceImageUri: storedJob.sourceImageUri,
      });
      // Also emit restore payload so the facade can restore tool + settings
      setRestorePayload({
        tool: storedTool,
        style: storedJob.style,
        sceneEditMode: storedJob.sceneEditMode,
        extraNote: storedJob.extraNote,
        sourceImageUri: storedJob.sourceImageUri,
        atmosphere: storedJob.atmosphere,
        materialLanguage: storedJob.materialLanguage,
        styleStrength: storedJob.styleStrength,
        planType: storedJob.planType,
        palette: storedJob.palette,
        presentationStyle: storedJob.presentationStyle,
        reportTone: storedJob.reportTone,
        roomLabels: storedJob.roomLabels,
        analysisFocus: storedJob.analysisFocus,
        multiAnglePreserve: storedJob.multiAnglePreserve,
        enhancePreserve: storedJob.enhancePreserve,
        scenePreserveAreas: storedJob.scenePreserveAreas,
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [currentUser?.uid, getToolLabel]);

  // ── Persist active job ─────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid || !activeJobId || !activeJobDraft) return;
    persistActiveJob(currentUser.uid, {
      jobId: activeJobId,
      toolId: activeJobDraft.toolId,
      style: activeJobDraft.style,
      sceneEditMode: activeJobDraft.sceneEditMode,
      extraNote: activeJobDraft.extraNote,
      outputType: activeJobDraft.outputType,
      generationVariant: activeJobDraft.generationVariant,
      sourceImageUri: activeJobDraft.sourceImageUri,
    });
  }, [activeJobDraft, activeJobId, currentUser?.uid]);

  // ── Clear stored job when no active job ────────────────────
  useEffect(() => {
    if (!activeJobId && currentUser?.uid) {
      clearStoredActiveJob(currentUser.uid);
    }
  }, [activeJobId, currentUser?.uid]);

  // ── Error toast for active job watch failure ───────────────
  useEffect(() => {
    if (!activeJobError) return;
    const isPermissionError =
      activeJobError.message?.toLowerCase().includes("permission") ||
      activeJobError.message?.toLowerCase().includes("insufficient");

    toast.error(t("dashboard.aiStudio.activeJobWatchFailed", { message: activeJobError.message }), { duration: 7000 });

    if (isPermissionError) {
      const id = window.setTimeout(() => {
        setActiveJobId(null);
        setActiveJobDraft(null);
        setJobFailureMessage(null);
        setSubmittingJob(false);
        if (currentUser?.uid) clearStoredActiveJob(currentUser.uid);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [activeJobError, currentUser?.uid, t]);

  // ── Restore tool/settings when observing a restored job ────
  useEffect(() => {
    if (!activeJobId || !activeJob.exists || restoredJobRef.current === activeJobId) return;
    restoredJobRef.current = activeJobId;
    const nextTool = getToolById(activeJob.toolId || activeJobDraft?.toolId || "");
    const nextSourceImageUri = activeJob.sourceImageUri || activeJobDraft?.sourceImageUri || "";

    const id = window.setTimeout(() => {
      setRestorePayload({
        tool: nextTool,
        style: activeJob.style,
        sceneEditMode: activeJob.sceneEditMode,
        extraNote: activeJob.extraNote,
        sourceImageUri: nextSourceImageUri,
      });
      // Note: Additional tool settings (atmosphere, planType, etc.) for the
      // second restore path would need to be read from stored job localStorage
      // since the Supabase job document may not contain them.
    }, 0);
    return () => window.clearTimeout(id);
  }, [activeJob.exists, activeJob.extraNote, activeJob.sceneEditMode, activeJob.sourceImageUri, activeJob.style, activeJob.toolId, activeJobDraft, activeJobId]);

  // ── Terminal handler ───────────────────────────────────────
  const resolveLabel = useCallback((key: string) => t(key), [t]);

  const getLoadingMessage = useCallback(
    (tool: ToolConfig) => {
      const toolLabel = getToolLabel(tool);
      if (tool.id === "plancolor") return t("dashboard.aiStudio.processingMinutes", { tool: toolLabel });
      if (tool.id === "sceneedit") return t("dashboard.aiStudio.processingSecondsLong", { tool: toolLabel });
      if (tool.outputType === "image") return t("dashboard.aiStudio.processingSeconds", { tool: toolLabel });
      return t("dashboard.aiStudio.preparingSeconds", { tool: toolLabel });
    },
    [getToolLabel, t],
  );

  const getSuccessMessage = useCallback(
    (tool: ToolConfig) => {
      const toolLabel = getToolLabel(tool);
      return t("dashboard.aiStudio.toolCompleted", { tool: toolLabel });
    },
    [getToolLabel, t],
  );

  // ── Terminal hook ──────────────────────────────────────────
  // Pass bridgingRef directly so useAiStudioJobTerminal can access
  // the result setters inside its effect (not during render).
  useAiStudioJobTerminal(
    activeJobId,
    activeJob,
    activeJobTool,
    null,
    activeJobDraft,
    getToolLabel,
    getSuccessMessage,
    addPromptHistoryEntry,
    bridgingRef,
    setJobFailureMessage,
    t,
    notify,
  );

  // ── handleGenerate ─────────────────────────────────────────
  const handleGenerate = useCallback(
    async (ctx: GenerateContext, options: { extraNoteOverride?: string; generationVariant?: string } = {}) => {
      const { selectedTool } = ctx;
      if (!selectedTool) return;

      // ── Duplicate submission guard ───────────────────────────
      // Prevents rapid double-clicks and multi-tab race conditions
      // from submitting the same job multiple times.
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      if (!ctx.hasPrimarySource) {
        toast.error(
          selectedTool.id === "sceneedit"
            ? t("dashboard.aiStudio.mainSceneRequired")
            : t("dashboard.aiStudio.referenceRequiredToast"),
        );
        isSubmittingRef.current = false;
        return;
      }
      if (selectedTool.id === "sceneedit" && !ctx.hasRequiredSceneReferences) {
        toast.error(t("dashboard.aiStudio.sceneReferenceRequiredToast"));
        isSubmittingRef.current = false;
        return;
      }
      if (!hasEnough(selectedTool.credit)) {
        toast.error(t("dashboard.aiStudio.creditRequiredToast", { credit: selectedTool.credit }), { duration: 4000 });
        isSubmittingRef.current = false;
        return;
      }

      let effectiveExtraNote = String(options.extraNoteOverride ?? ctx.extraNote ?? "").trim();
      const generationVariant = String(options.generationVariant || "default");

      effectiveExtraNote = buildToolNote(
        selectedTool.id,
        effectiveExtraNote,
        {
          analysisFocus: ctx.analysisFocus,
          reportTone: ctx.reportTone,
          revisionType: ctx.revisionType,
          scenePreserveAreas: ctx.scenePreserveAreas,
          atmosphere: ctx.atmosphere,
          materialLanguage: ctx.materialLanguage,
          styleStrength: ctx.styleStrength,
          enhancePreserve: ctx.enhancePreserve,
          multiAnglePreserve: ctx.multiAnglePreserve,
          planType: ctx.planType,
          palette: ctx.palette,
          presentationStyle: ctx.presentationStyle,
          roomLabels: ctx.roomLabels,
        },
        resolveLabel,
      );

      let promptContract: PromptContract | null = null;
      if (isFeatureEnabled("promptEngineV3")) {
        promptContract = buildToolContract(
          selectedTool.id,
          {
            analysisFocus: ctx.analysisFocus,
            reportTone: ctx.reportTone,
            revisionType: ctx.revisionType,
            scenePreserveAreas: ctx.scenePreserveAreas,
            atmosphere: ctx.atmosphere,
            materialLanguage: ctx.materialLanguage,
            styleStrength: ctx.styleStrength,
            enhancePreserve: ctx.enhancePreserve,
            multiAnglePreserve: ctx.multiAnglePreserve,
            planType: ctx.planType,
            palette: ctx.palette,
            presentationStyle: ctx.presentationStyle,
            roomLabels: ctx.roomLabels,
            extraNote: effectiveExtraNote,
            style: ctx.style,
            sceneEditMode: ctx.sceneEditMode,
            generationVariant,
            sceneReferences: ctx.sceneReferences,
          },
          resolveLabel,
        );
      }

      const isImage = selectedTool.outputType === "image";
      const toastId = toast.loading(getLoadingMessage(selectedTool));

      try {
        setSubmittingJob(true);

        const activeReferences =
          selectedTool.id === "sceneedit"
            ? ctx.sceneReferences.filter((ref) => ref.file || ref.url).slice(0, 4).map((ref) => ({
                type: ref.type,
                label: ref.label,
                note: ref.note,
                file: ref.file || null,
                url: ref.url || "",
              }))
            : [];

        const backendToolId = selectedTool.id === "multi-angle" ? "img2img" : selectedTool.id;

        const nextJobDraft: ActiveJobDraft = {
          id: "",
          toolId: backendToolId,
          toolLabel: getToolLabel(selectedTool),
          outputType: selectedTool.outputType,
          style: selectedTool.hasStyle ? ctx.style : "",
          sceneEditMode: selectedTool.id === "sceneedit" ? ctx.sceneEditMode : "",
          referenceCount: activeReferences.length,
          extraNote: effectiveExtraNote,
          generationVariant,
          createdAt: new Date().toISOString(),
          sourceImageUri: ctx.selectedFileUrl || ctx.refImagePreview || "",
        };

        const { jobId } = await queueAiStudioJob({
          toolId: backendToolId,
          imageFile: ctx.refImageFile || null,
          imageUrl: ctx.selectedFileUrl || null,
          style: ctx.style,
          extraNote: effectiveExtraNote,
          sceneEditMode: ctx.sceneEditMode,
          generationVariant,
          references: activeReferences,
          scenePreserveAreas: ctx.scenePreserveAreas,
          promptContract: promptContract || undefined,
        });

        // Queue succeeded — now safe to clear old results and commit new draft.
        // (Facade also clears at the top of handleGenerate, but we re-clear here
        //  to guarantee the bridgingRef sees a clean state before the new jobId
        //  triggers observation.)
        bridgingRef.current.setResultImage(null);
        bridgingRef.current.setResultText(null);
        bridgingRef.current.setResultMeta(null);
        bridgingRef.current.setCompareSplit(50);
        bridgingRef.current.setRevisionSteps([]);
        bridgingRef.current.setRevisionCursor(-1);

        const persistedDraft = { ...nextJobDraft, id: jobId };
        restoredJobRef.current = "";
        setActiveJobId(jobId);
        setActiveJobDraft(persistedDraft);

        if (currentUser?.uid) {
          persistActiveJob(currentUser.uid, {
            jobId,
            toolId: persistedDraft.toolId,
            style: persistedDraft.style,
            sceneEditMode: persistedDraft.sceneEditMode,
            extraNote: persistedDraft.extraNote,
            outputType: persistedDraft.outputType,
            generationVariant: persistedDraft.generationVariant,
            sourceImageUri: persistedDraft.sourceImageUri,
          });
        }

        if (currentUser?.uid && activeWorkspace?.id) {
          try {
            await createActivityLogEntry(null, {
              workspaceId: activeWorkspace.id,
              category: "ai",
              action: "aiJobQueued",
              actorUid: currentUser.uid,
              actorEmail: currentUser.email || "",
              actorName: currentUser.name || currentUser.email || t("common.user"),
              targetType: "ai_job",
              targetId: jobId,
              targetName: getToolLabel(selectedTool),
              metadata: { toolId: selectedTool.id, creditCost: selectedTool.credit },
              timestamp: null,
            });
          } catch {
            // Activity log is non-blocking admin operation
            if (process.env.NODE_ENV !== "production") {
              console.warn("[ai-studio] Activity log creation failed (non-blocking)");
            }
          }
        }

        toast.success(t("dashboard.aiStudio.queuedToast", { tool: getToolLabel(selectedTool) }), { id: toastId });
      } catch (error) {
        toast.error(
          getFriendlyAIError(error, isImage, {
            permissionImage: t("dashboard.aiStudio.aiAuthorizationError"),
            permissionAnalysis: t("dashboard.aiStudio.aiAnalysisAuthorizationError"),
            generic: t("errors.generic"),
          }),
          { id: toastId, duration: 9000 },
        );
      } finally {
        setSubmittingJob(false);
        isSubmittingRef.current = false;
      }
    },
    [currentUser, activeWorkspace, getLoadingMessage, getToolLabel, hasEnough, resolveLabel, t, bridgingRef],
  );

  // ── Variation ──────────────────────────────────────────────
  const runVariation = useCallback(
    (ctx: GenerateContext) => {
      const baseNote = String(ctx.extraNote || "").trim();
      const variationNote = baseNote ? `${baseNote}\n\n${VARIATION_NOTE_SUFFIX}` : VARIATION_NOTE_SUFFIX;
      void handleGenerate(ctx, { extraNoteOverride: variationNote, generationVariant: "variation" });
    },
    [handleGenerate],
  );

  // ── Prompt inspiration ─────────────────────────────────────
  const handleGeneratePromptInspiration = useCallback(
    async (ctx: GenerateContext): Promise<string | null> => {
      if (!ctx.selectedTool) return null;
      if (!ctx.hasPrimarySource) {
        toast.error(t("dashboard.aiStudio.referenceRequiredToast"));
        return null;
      }
      if (!["img2img", "enhance", "plancolor"].includes(ctx.selectedTool.id)) {
        toast.error(t("dashboard.aiStudio.unsupportedToolForInspiration"));
        return null;
      }

      setGeneratingPromptInspiration(true);
      try {
        const { text } = await generatePromptInspiration({
          imageFile: ctx.refImageFile,
          imageUrl: ctx.selectedFileUrl,
          style: ctx.selectedTool.hasStyle || ctx.selectedTool.id === "enhance" ? ctx.style : "modern",
          targetTool: ctx.selectedTool.id,
        });
        return text;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("dashboard.aiStudio.promptInspirationFailed"));
        return null;
      } finally {
        setGeneratingPromptInspiration(false);
      }
    },
    [t],
  );

  // ── Feedback ───────────────────────────────────────────────
  const handleFeedback = useCallback(
    async (feedback: AiStudioJobFeedback) => {
      if (!currentUser?.uid || !activeJobId) return;
      try {
        await saveAiJobFeedback(currentUser.uid, activeJobId, feedback);
        toast.success(
          feedback === "positive"
            ? t("dashboard.aiStudio.feedbackPositive")
            : t("dashboard.aiStudio.feedbackNegative"),
        );
      } catch {
        toast.error(t("dashboard.aiStudio.feedbackFailed"));
      }
    },
    [activeJobId, currentUser, t],
  );

  return {
    // State
    activeJobId,
    activeJobDraft,
    submittingJob,
    generatingPromptInspiration,
    jobFailureMessage,
    activeJob,
    activeJobLoading,
    activeJobError,
    activeJobTool,
    promptHistoryByTool,
    userModifiedInputRef,
    restorePayload,

    // Setters
    setActiveJobId,
    setActiveJobDraft,
    setJobFailureMessage,
    setRestorePayload,
    setPromptHistoryByTool,

    // Actions
    handleGenerate,
    runVariation,
    handleGeneratePromptInspiration,
    handleFeedback,
    addPromptHistoryEntry,

    // Safe ref mutation helper (avoids direct .current access from parent)
    markInputModified,
  };
}
