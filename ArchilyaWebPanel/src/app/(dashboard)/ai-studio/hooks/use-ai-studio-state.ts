"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";

import { useAuth } from "@/components/providers/auth-provider";
import { useCredits } from "@/hooks/use-credits";
import { useDesktopNotification } from "@/hooks/use-desktop-notification";
import { useProjects } from "@/hooks/use-projects";
import { useWorkspace } from "@/hooks/use-workspace";

import { TOOLS } from "../constants";
import { deriveAiStudioState } from "../lib/derive-state";
import { useAiStudioJobLifecycle, type ResultBridgingRef } from "./use-ai-studio-job-lifecycle";
import { useAiStudioFileInput } from "./use-ai-studio-file-input";
import { useAiStudioResult } from "./use-ai-studio-result";
import { useAiStudioSettings } from "./use-ai-studio-settings";
import { useAiStudioToolSelection } from "./use-ai-studio-tool-selection";
import { clearStoredActiveJob, revokeObjectUrlSafe } from "../utils";

/**
 * useAiStudioState — Orchestrator facade
 *
 * Composes 4 sub-hooks into the same interface that existing consumers expect.
 *
 * Sub-hooks:
 *  - useAiStudioToolSelection   : tool switching, revision type, edit mode
 *  - useAiStudioSettings        : tool-specific parameter states
 *  - useAiStudioJobLifecycle    : submit, poll, retry, feedback
 *  - useAiStudioResult          : result display, revisions, file ops
 */
export function useAiStudioState() {
  const t = useTranslations();
  const { currentUser } = useAuth();
  const ownerName =
    currentUser?.name?.trim() ||
    currentUser?.email?.split("@")[0] ||
    t("common.user");
  const { credits, plan, hasEnough } = useCredits();
  const { projects, refresh: refreshProjects } = useProjects(
    currentUser?.uid ?? null,
    currentUser?.email ?? null,
    ownerName,
    true,
    "",
    null,
  );
  const { updatePoolStorage, activeWorkspace } = useWorkspace();
  const { notify, requestPermission } = useDesktopNotification();

  // ── Sub-hooks ──────────────────────────────────────────────
  const toolSelection = useAiStudioToolSelection();
  const settings = useAiStudioSettings();
  const fileInput = useAiStudioFileInput();
  const result = useAiStudioResult({
    currentUser,
    ownerName,
    imageSourceMessages: useMemo(
      () => ({
        missingSource: t("dashboard.aiStudio.imageSourceMissing"),
        downloadFailed: t("dashboard.aiStudio.imageDownloadFailed"),
      }),
      [t],
    ),
    myProjects: useMemo(
      () => (projects || []).filter((p) => !p.isDeleted),
      [projects],
    ),
    refreshProjects,
    updatePoolStorage,
  });

  // ── Stable ref bridging job-lifecycle terminal events → result state ──
  // Use useMemo to create stable callbacks that delegate to the latest result setters.
  const bridgingRef = useRef<ResultBridgingRef>({
    setResultMeta: result.setResultMeta,
    setCompareSplit: result.setCompareSplit,
    setResultText: result.setResultText,
    setResultImage: result.setResultImage,
    setRevisionSteps: result.setRevisionSteps,
    setRevisionCursor: result.setRevisionCursor,
  });
  // Update ref current value in an effect to avoid mutation during render.
  useEffect(() => {
    bridgingRef.current = {
      setResultMeta: result.setResultMeta,
      setCompareSplit: result.setCompareSplit,
      setResultText: result.setResultText,
      setResultImage: result.setResultImage,
      setRevisionSteps: result.setRevisionSteps,
      setRevisionCursor: result.setRevisionCursor,
    };
  }, [result]);

  const getToolLabel = useCallback(
    (tool: (typeof TOOLS)[number]) =>
      t(`dashboard.aiStudio.tools.${tool.id}.label`),
    [t],
  );

  const jobLifecycle = useAiStudioJobLifecycle({
    currentUser,
    ownerName,
    credits,
    hasEnough,
    activeWorkspace,
    updatePoolStorage,
    getToolLabel,
    t,
    notify,
    bridgingRef,
  });

  // ── Job restore handler ────────────────────────────────────
  // When the job lifecycle detects a restored in-flight job, apply
  // the stored tool and ALL tool-specific settings.
  useEffect(() => {
    const payload = jobLifecycle.restorePayload;
    if (!payload) return;
    if (payload.tool) {
      toolSelection.setSelectedTool(payload.tool);
    }
    if (payload.style) settings.setStyle(payload.style);
    if (payload.sceneEditMode) toolSelection.setSceneEditMode(payload.sceneEditMode);
    if (payload.extraNote !== undefined) settings.setExtraNote(payload.extraNote || "");
    if (payload.atmosphere) settings.setAtmosphere(payload.atmosphere);
    if (payload.materialLanguage) settings.setMaterialLanguage(payload.materialLanguage);
    if (payload.styleStrength) settings.setStyleStrength(payload.styleStrength);
    if (payload.planType) settings.setPlanType(payload.planType);
    if (payload.palette) settings.setPalette(payload.palette);
    if (payload.presentationStyle) settings.setPresentationStyle(payload.presentationStyle);
    if (payload.reportTone) settings.setReportTone(payload.reportTone);
    if (typeof payload.roomLabels === "boolean") settings.setRoomLabels(payload.roomLabels);
    if (payload.analysisFocus) settings.setAnalysisFocus(payload.analysisFocus);
    if (payload.multiAnglePreserve) settings.setMultiAnglePreserve(payload.multiAnglePreserve);
    if (payload.enhancePreserve) settings.setEnhancePreserve(payload.enhancePreserve);
    if (payload.scenePreserveAreas) settings.setScenePreserveAreas(payload.scenePreserveAreas);
    if (payload.sourceImageUri && !fileInput.refImagePreview) {
      const uri = payload.sourceImageUri;
      startTransition(() => {
        fileInput.setSelectedFileUrl(uri);
        fileInput.setRefImagePreview(uri);
        fileInput.setRefImageFile(null);
      });
    }
  }, [jobLifecycle.restorePayload, fileInput, toolSelection, settings]);

  // Re-derive computed with actual ref state
  const computedWithRefs = useMemo(
    () =>
        deriveAiStudioState({
        refImageFile: fileInput.refImageFile,
        selectedFileUrl: fileInput.selectedFileUrl,
        sceneReferences: fileInput.sceneReferences,
        selectedTool: toolSelection.selectedTool,
        activeJobId: jobLifecycle.activeJobId,
        activeJob: jobLifecycle.activeJob,
        submittingJob: jobLifecycle.submittingJob,
        activeJobLoading: jobLifecycle.activeJobLoading,
        activeJobError: jobLifecycle.activeJobError,
        activeJobDraft: jobLifecycle.activeJobDraft,
        revisionCursor: result.revisionCursor,
        revisionSteps: result.revisionSteps,
        promptHistoryByTool: jobLifecycle.promptHistoryByTool,
      }),
    [
       fileInput.refImageFile,
       fileInput.selectedFileUrl,
       fileInput.sceneReferences,
      toolSelection.selectedTool,
      jobLifecycle.activeJobId,
      jobLifecycle.activeJob,
      jobLifecycle.submittingJob,
      jobLifecycle.activeJobLoading,
      jobLifecycle.activeJobError,
      jobLifecycle.activeJobDraft,
      result.revisionCursor,
      result.revisionSteps,
      jobLifecycle.promptHistoryByTool,
    ],
  );

  // ── Actions ────────────────────────────────────────────────

  // Clear reference image
  const clearRef = useCallback(() => {
    fileInput.clearRefState();
    fileInput.setSceneReferences([]);

    // Clear job + result state
    jobLifecycle.setActiveJobId(null);
    jobLifecycle.setActiveJobDraft(null);
    result.setResultImage(null);
    result.setResultText(null);
    result.setResultMeta(null);
    jobLifecycle.setJobFailureMessage(null);
    // Prevent restorePayload from re-setting refImagePreview
    jobLifecycle.setRestorePayload(null);
    result.setRevisionSteps([]);
    result.setRevisionCursor(-1);
    settings.resetToDefaults();
    if (currentUser?.uid) {
      clearStoredActiveJob(currentUser.uid);
    }
    jobLifecycle.markInputModified();
  }, [currentUser, fileInput, jobLifecycle, result, settings]);

  const handlePrimaryFileSelection = useCallback((file: File) => {
    clearRef();
    fileInput.handlePrimaryFileSelection(file);
  }, [clearRef, fileInput]);

  const handlePrimaryDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    fileInput.setPrimaryDropActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handlePrimaryFileSelection(file);
  }, [fileInput, handlePrimaryFileSelection]);

  const handleGenerate = useCallback(
    (options: { extraNoteOverride?: string; generationVariant?: string } = {}) => {
      const tool = toolSelection.selectedTool;
      if (!tool) return;
      void requestPermission();
      // Clear results + failure state before generating
      result.setResultImage(null);
      result.setResultText(null);
      result.setResultMeta(null);
      result.setCompareSplit(50);
      result.setRevisionSteps([]);
      result.setRevisionCursor(-1);
      jobLifecycle.setJobFailureMessage(null);
      void jobLifecycle.handleGenerate(
        {
          selectedTool: tool,
          style: settings.style,
          extraNote: settings.extraNote,
      sceneEditMode: toolSelection.sceneEditMode,
      revisionType: settings.revisionType,
          analysisFocus: settings.analysisFocus,
          multiAnglePreserve: settings.multiAnglePreserve,
          atmosphere: settings.atmosphere,
          materialLanguage: settings.materialLanguage,
          styleStrength: settings.styleStrength,
          enhancePreserve: settings.enhancePreserve,
          scenePreserveAreas: settings.scenePreserveAreas,
          planType: settings.planType,
          palette: settings.palette,
          roomLabels: settings.roomLabels,
          presentationStyle: settings.presentationStyle,
          reportTone: settings.reportTone,
          sceneReferences: fileInput.sceneReferences,
          refImageFile: fileInput.refImageFile,
          selectedFileUrl: fileInput.selectedFileUrl,
          refImagePreview: fileInput.refImagePreview,
          hasPrimarySource: computedWithRefs.hasPrimarySource,
          hasRequiredSceneReferences: computedWithRefs.hasRequiredSceneReferences,
        },
        options,
      );
    },
    [
      toolSelection.selectedTool,
      toolSelection.sceneEditMode,
      settings.revisionType,
      settings.style,
      settings.extraNote,
      settings.analysisFocus,
      settings.multiAnglePreserve,
      settings.atmosphere,
      settings.materialLanguage,
      settings.styleStrength,
      settings.enhancePreserve,
      settings.scenePreserveAreas,
      settings.planType,
      settings.palette,
      settings.roomLabels,
      settings.presentationStyle,
      settings.reportTone,
      fileInput.sceneReferences,
      fileInput.refImageFile,
      fileInput.selectedFileUrl,
      fileInput.refImagePreview,
      computedWithRefs.hasPrimarySource,
      computedWithRefs.hasRequiredSceneReferences,
      jobLifecycle.handleGenerate,
    ],
  );

  const runVariation = useCallback(() => {
    if (!toolSelection.selectedTool) return;
    void jobLifecycle.runVariation({
      selectedTool: toolSelection.selectedTool,
      style: settings.style,
      extraNote: settings.extraNote,
      sceneEditMode: toolSelection.sceneEditMode,
      revisionType: settings.revisionType,
      analysisFocus: settings.analysisFocus,
      multiAnglePreserve: settings.multiAnglePreserve,
      atmosphere: settings.atmosphere,
      materialLanguage: settings.materialLanguage,
      styleStrength: settings.styleStrength,
      enhancePreserve: settings.enhancePreserve,
      scenePreserveAreas: settings.scenePreserveAreas,
      planType: settings.planType,
      palette: settings.palette,
      roomLabels: settings.roomLabels,
      presentationStyle: settings.presentationStyle,
      reportTone: settings.reportTone,
      sceneReferences: fileInput.sceneReferences,
      refImageFile: fileInput.refImageFile,
      selectedFileUrl: fileInput.selectedFileUrl,
      refImagePreview: fileInput.refImagePreview,
      hasPrimarySource: computedWithRefs.hasPrimarySource,
      hasRequiredSceneReferences: computedWithRefs.hasRequiredSceneReferences,
    });
  }, [
    toolSelection.selectedTool,
    settings, fileInput.sceneReferences, fileInput.refImageFile, fileInput.selectedFileUrl, fileInput.refImagePreview,
    computedWithRefs.hasPrimarySource, computedWithRefs.hasRequiredSceneReferences,
    toolSelection.sceneEditMode,
    jobLifecycle.runVariation,
  ]);

  const useResultAsPrimaryScene = useCallback(() => {
    const src = result.useResultAsPrimaryScene();
    if (!src) return;
    revokeObjectUrlSafe(fileInput.refImagePreview);
    fileInput.setRefImageFile(null);
    fileInput.setSelectedFileUrl(src);
    fileInput.setRefImagePreview(src);
  }, [result, fileInput]);

  const handleGeneratePromptInspiration = useCallback(async () => {
    if (!toolSelection.selectedTool) return;
    const text = await jobLifecycle.handleGeneratePromptInspiration({
      selectedTool: toolSelection.selectedTool,
      style: settings.style,
      extraNote: settings.extraNote,
      sceneEditMode: toolSelection.sceneEditMode,
      revisionType: settings.revisionType,
      analysisFocus: settings.analysisFocus,
      multiAnglePreserve: settings.multiAnglePreserve,
      atmosphere: settings.atmosphere,
      materialLanguage: settings.materialLanguage,
      styleStrength: settings.styleStrength,
      enhancePreserve: settings.enhancePreserve,
      scenePreserveAreas: settings.scenePreserveAreas,
      planType: settings.planType,
      palette: settings.palette,
      roomLabels: settings.roomLabels,
      presentationStyle: settings.presentationStyle,
      reportTone: settings.reportTone,
       sceneReferences: fileInput.sceneReferences,
       refImageFile: fileInput.refImageFile,
       selectedFileUrl: fileInput.selectedFileUrl,
       refImagePreview: fileInput.refImagePreview,
      hasPrimarySource: computedWithRefs.hasPrimarySource,
      hasRequiredSceneReferences: computedWithRefs.hasRequiredSceneReferences,
    });
    if (text !== null) {
      settings.setExtraNote(text);
    }
  }, [
    toolSelection.selectedTool, settings, fileInput.sceneReferences, fileInput.refImageFile,
    fileInput.selectedFileUrl, fileInput.refImagePreview, computedWithRefs.hasPrimarySource,
      computedWithRefs.hasRequiredSceneReferences, toolSelection.sceneEditMode,
    settings.revisionType, jobLifecycle.handleGeneratePromptInspiration,
  ]);

  // ── Consolidate return shape ───────────────────────────────

  const auth = useMemo(
    () => ({ currentUser, ownerName }),
    [currentUser, ownerName],
  );
  const creditsGroup = useMemo(
    () => ({ credits, plan, hasEnough }),
    [credits, plan, hasEnough],
  );
  const myProjects = useMemo(
    () => (projects || []).filter((p) => !p.isDeleted),
    [projects],
  );
  const projectsGroup = useMemo(
    () => ({ myProjects, refreshProjects }),
    [myProjects, refreshProjects],
  );
  const workspace = useMemo(() => ({ updatePoolStorage }), [updatePoolStorage]);

  const state = useMemo(
    () => ({
      selectedTool: toolSelection.selectedTool,
      refImageFile: fileInput.refImageFile,
      refImagePreview: fileInput.refImagePreview,
      selectedFileUrl: fileInput.selectedFileUrl,
      style: settings.style,
      extraNote: settings.extraNote,
      submittingJob: jobLifecycle.submittingJob,
      generatingPromptInspiration: jobLifecycle.generatingPromptInspiration,
      activeJobId: jobLifecycle.activeJobId,
      activeJobDraft: jobLifecycle.activeJobDraft,
      jobFailureMessage: jobLifecycle.jobFailureMessage,
      resultText: result.resultText,
      resultImage: result.resultImage,
      resultMeta: result.resultMeta,
      compareSplit: result.compareSplit,
      sceneEditMode: toolSelection.sceneEditMode,
      revisionType: settings.revisionType,
      sceneReferences: fileInput.sceneReferences,
      analysisFocus: settings.analysisFocus,
      multiAnglePreserve: settings.multiAnglePreserve,
      atmosphere: settings.atmosphere,
      materialLanguage: settings.materialLanguage,
      styleStrength: settings.styleStrength,
      enhancePreserve: settings.enhancePreserve,
      scenePreserveAreas: settings.scenePreserveAreas,
      planType: settings.planType,
      palette: settings.palette,
      roomLabels: settings.roomLabels,
      presentationStyle: settings.presentationStyle,
      reportTone: settings.reportTone,
      promptHistoryByTool: jobLifecycle.promptHistoryByTool,
      revisionSteps: result.revisionSteps,
      revisionCursor: result.revisionCursor,
      saving: result.saving,
      sharing: result.sharing,
      primaryDropActive: fileInput.primaryDropActive,
    }),
    [
      toolSelection.selectedTool,
      fileInput.refImageFile, fileInput.refImagePreview, fileInput.selectedFileUrl,
      settings.style, settings.extraNote,
      settings.analysisFocus, settings.multiAnglePreserve,
      settings.atmosphere, settings.materialLanguage,
      settings.styleStrength, settings.enhancePreserve,
      settings.scenePreserveAreas, settings.planType,
      settings.palette, settings.roomLabels,
      settings.presentationStyle, settings.reportTone,
      jobLifecycle.submittingJob, jobLifecycle.generatingPromptInspiration,
      jobLifecycle.activeJobId, jobLifecycle.activeJobDraft,
      jobLifecycle.jobFailureMessage, jobLifecycle.promptHistoryByTool,
      result.resultText, result.resultImage, result.resultMeta,
      result.compareSplit, result.revisionSteps, result.revisionCursor,
      result.saving, result.sharing,
      toolSelection.sceneEditMode, settings.revisionType,
      fileInput.sceneReferences,
      fileInput.primaryDropActive,
    ],
  );

  const refs = useMemo(
    () => ({ fileInputRef: fileInput.fileInputRef, sceneReferenceInputRef: fileInput.sceneReferenceInputRef }),
    [fileInput.fileInputRef, fileInput.sceneReferenceInputRef],
  );

  const computed = useMemo(
    () => ({
      ...computedWithRefs,
      hasPrimarySource: computedWithRefs.hasPrimarySource,
      hasRequiredSceneReferences: computedWithRefs.hasRequiredSceneReferences,
      canUndoRevision: computedWithRefs.canUndoRevision,
      canRedoRevision: computedWithRefs.canRedoRevision,
      activePromptHistory: computedWithRefs.activePromptHistory,
      hasActiveJobInFlight: computedWithRefs.hasActiveJobInFlight,
      generating: computedWithRefs.generating,
      activeJobTool: computedWithRefs.activeJobTool,
      visibleTool: computedWithRefs.visibleTool,
    }),
    [computedWithRefs],
  );

  const job = useMemo(
    () => ({
      activeJob: jobLifecycle.activeJob,
      activeJobLoading: jobLifecycle.activeJobLoading,
      activeJobError: jobLifecycle.activeJobError,
    }),
    [
      jobLifecycle.activeJob,
      jobLifecycle.activeJobLoading,
      jobLifecycle.activeJobError,
    ],
  );

  // ── Wrapped selectTool: clears results + failure, delegates other cleanup to callers ──
  // Note: settings.resetToDefaults() is intentionally NOT called here.
  // Callers that need a full reset (clearRef, finalizeToolSwitch) already call resetToDefaults
  // via clearRef. Calling it here too causes double-reset React state batching issues
  // that freeze the UI during tool switching.
  const wrappedSelectTool = useCallback(
    (tool: import("../types").ToolConfig) => {
      toolSelection.selectTool(tool);
      // Clear tool-specific results so old results don't bleed into the new tool
      result.setResultImage(null);
      result.setResultText(null);
      result.setResultMeta(null);
      result.setCompareSplit(50);
      result.setRevisionSteps([]);
      result.setRevisionCursor(-1);
      // Clear job failure
      jobLifecycle.setJobFailureMessage(null);
    },
    [toolSelection, result, jobLifecycle],
  );

  /**
   * switchTool — Tool switch WITHOUT settings reset.
   *
   * Clears file input, job state, and result state, then selects the new tool.
   * Settings are intentionally NOT reset here — the user's prompt/params are
   * preserved across tool switches.  Only explicit "clear" actions reset settings.
   */
  const switchTool = useCallback(
    (tool: import("../types").ToolConfig) => {
      // ── clearRef logic (minus settings reset) ──
      fileInput.clearRefState();
      fileInput.setSceneReferences([]);
      jobLifecycle.setActiveJobId(null);
      jobLifecycle.setActiveJobDraft(null);
      jobLifecycle.setJobFailureMessage(null);
      // Prevent the restorePayload effect from re-setting refImagePreview
      // after clearRefState has set it to null. Without this, the effect
      // sees refImagePreview === null and restores the old sourceImageUri,
      // causing a broken "Referans Hazır" badge and frozen UI.
      jobLifecycle.setRestorePayload(null);
      if (currentUser?.uid) {
        clearStoredActiveJob(currentUser.uid);
      }
      jobLifecycle.markInputModified();

      // ── wrappedSelectTool logic ──
      toolSelection.selectTool(tool);
      result.setResultImage(null);
      result.setResultText(null);
      result.setResultMeta(null);
      result.setCompareSplit(50);
      result.setRevisionSteps([]);
      result.setRevisionCursor(-1);
    },
    [currentUser, fileInput, jobLifecycle, result, toolSelection],
  );

  const actions = useMemo(
    () => ({
      selectTool: wrappedSelectTool,
      switchTool,
      clearRef,
      appendSceneReference: fileInput.appendSceneReference,
      removeSceneReference: fileInput.removeSceneReference,
      handlePrimaryFileSelection,
      handlePrimaryDrop,
      handleGenerate,
      handleDownloadCurrentResult: result.handleDownloadCurrentResult,
      applyPromptHistory: toolSelection.applyPromptHistory,
      handleUndo: result.handleUndo,
      handleRedo: result.handleRedo,
      useResultAsPrimaryScene,
      runVariation,
      handleNativeShare: result.handleNativeShare,
      handleSaveResultToProject: result.handleSaveResultToProject,
      hideResult: result.hideResult,
      restoreLastResult: result.restoreLastResult,
      handleFeedback: jobLifecycle.handleFeedback,
      handleGeneratePromptInspiration,
    }),
    [
      wrappedSelectTool,
      switchTool,
      toolSelection.applyPromptHistory,
       clearRef, fileInput.appendSceneReference, fileInput.removeSceneReference,
       handlePrimaryFileSelection, handlePrimaryDrop,
      handleGenerate, runVariation,
      result.handleDownloadCurrentResult,
      result.handleUndo, result.handleRedo,
      result.handleNativeShare, result.handleSaveResultToProject,
      result.hideResult, result.restoreLastResult,
      useResultAsPrimaryScene,
      jobLifecycle.handleFeedback,
      handleGeneratePromptInspiration,
    ],
  );

  const setters = useMemo(
    () => ({
      setStyle: settings.setStyle,
      setExtraNote: settings.setExtraNote,
      setSceneEditMode: toolSelection.setSceneEditMode,
      setRevisionType: settings.setRevisionType,
      setAnalysisFocus: settings.setAnalysisFocus,
      setMultiAnglePreserve: settings.setMultiAnglePreserve,
      setAtmosphere: settings.setAtmosphere,
      setMaterialLanguage: settings.setMaterialLanguage,
      setStyleStrength: settings.setStyleStrength,
      setEnhancePreserve: settings.setEnhancePreserve,
      setScenePreserveAreas: settings.setScenePreserveAreas,
      setPlanType: settings.setPlanType,
      setPalette: settings.setPalette,
      setRoomLabels: settings.setRoomLabels,
      setPresentationStyle: settings.setPresentationStyle,
      setReportTone: settings.setReportTone,
      setCompareSplit: result.setCompareSplit,
      setPrimaryDropActive: fileInput.setPrimaryDropActive,
      setResultText: result.setResultText,
      setResultImage: result.setResultImage,
      setSelectedFileUrl: fileInput.setSelectedFileUrl,
      setRefImagePreview: fileInput.setRefImagePreview,
      setRefImageFile: fileInput.setRefImageFile,
      setJobFailureMessage: jobLifecycle.setJobFailureMessage,
    }),
    [
      settings.setStyle, settings.setExtraNote,
      settings.setAnalysisFocus, settings.setMultiAnglePreserve,
      settings.setAtmosphere, settings.setMaterialLanguage,
      settings.setStyleStrength, settings.setEnhancePreserve,
      settings.setScenePreserveAreas, settings.setPlanType,
      settings.setPalette, settings.setRoomLabels,
      settings.setPresentationStyle, settings.setReportTone,
      toolSelection.setSceneEditMode, settings.setRevisionType,
       result.setCompareSplit, result.setResultText, result.setResultImage,
       fileInput.setPrimaryDropActive, fileInput.setSelectedFileUrl,
       fileInput.setRefImagePreview, fileInput.setRefImageFile,
       jobLifecycle.setJobFailureMessage,
    ],
  );

  return useMemo(
    () => ({
      auth,
      credits: creditsGroup,
      projects: projectsGroup,
      workspace,
      state,
      refs,
      computed,
      job,
      actions,
      setters,
      // Sub-hook instances for smart component composition
      fileInput,
      toolSelection,
      settings,
      result,
      jobLifecycle,
    }),
    [auth, creditsGroup, projectsGroup, workspace, state, refs, computed, job, actions, setters, fileInput, toolSelection, settings, result, jobLifecycle],
  );
}
