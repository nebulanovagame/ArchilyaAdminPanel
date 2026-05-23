"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

import { useAuth } from "@/components/providers/auth-provider";
import { useAiStudioJob } from "@/hooks/use-ai-studio-job";
import { useCredits } from "@/hooks/use-credits";
import { useDesktopNotification } from "@/hooks/use-desktop-notification";
import { useProjects } from "@/hooks/use-projects";
import { useWorkspace } from "@/hooks/use-workspace";
import { createActivityLogEntry } from "@/lib/activity/service";
import { isAiStudioJobTerminal } from "@/lib/ai-studio/job-contract";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { logAiGenerationSuccess } from "@/lib/analytics/events";
import { saveAiJobFeedback } from "@/lib/ai-studio/service";
import type { AiStudioJobFeedback } from "@/lib/ai-studio/service";
import { uploadProjectFiles } from "@/lib/projects/service";
import type { ProjectRecord } from "@/lib/projects/types";
import { getAiPromptHistorySecure, saveAiPromptHistorySecure } from "@/services/entitlement-service";
import { generatePromptInspiration, queueAiStudioJob } from "@/services/nano-banana-service";

import { TOOLS, VARIATION_NOTE_SUFFIX } from "../constants";
import type { PromptHistoryEntry, ResultImage, ResultMeta, ResultRevisionStep, ActiveJobDraft, SceneReference } from "../types";
import {
  buildDefaultAiFileName,
  getToolById,
  isDataUrl,
  getMimeAndExtFromImageSource,
  imageSourceToFile,
  ensureFileExtension,
  sanitizePromptHistoryEntry,
  sanitizePromptHistoryMap,
  readStoredActiveJob,
  persistActiveJob,
  clearStoredActiveJob,
  toIsoString,
  getFriendlyAIError,
  revokeObjectUrlSafe,
} from "../utils";

export function useAiStudioState() {
  const t = useTranslations();
  const { currentUser, loading: authLoading } = useAuth();
  const ownerName = currentUser?.displayName?.trim() || currentUser?.email?.split("@")[0] || t("common.user");
  const { credits, hasEnough } = useCredits();
  const { projects, refresh: refreshProjects } = useProjects(currentUser?.uid ?? null, currentUser?.email ?? null, ownerName, true, "", null);
  const { updatePoolStorage, activeWorkspace } = useWorkspace();
  const { notify, requestPermission } = useDesktopNotification();

  const [selectedTool, setSelectedTool] = useState<(typeof TOOLS)[number] | null>(null);
  const [refImageFile, setRefImageFile] = useState<File | null>(null);
  const [refImagePreview, setRefImagePreview] = useState<string | null>(null);
  const [selectedFileUrl, setSelectedFileUrl] = useState("");
  const [style, setStyle] = useState("modern");
  const [extraNote, setExtraNote] = useState("");
  const [submittingJob, setSubmittingJob] = useState(false);
  const [generatingPromptInspiration, setGeneratingPromptInspiration] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobDraft, setActiveJobDraft] = useState<ActiveJobDraft | null>(null);
  const [jobFailureMessage, setJobFailureMessage] = useState<string | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<ResultImage | null>(null);
  const [resultMeta, setResultMeta] = useState<ResultMeta | null>(null);
  const [compareSplit, setCompareSplit] = useState(50);
  const [sceneEditMode, setSceneEditMode] = useState("scene-compose");
  const [sceneReferences, setSceneReferences] = useState<SceneReference[]>([]);
  const [promptHistoryByTool, setPromptHistoryByTool] = useState<Record<string, PromptHistoryEntry[]>>({});
  const [revisionSteps, setRevisionSteps] = useState<ResultRevisionStep[]>([]);
  const [revisionCursor, setRevisionCursor] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [primaryDropActive, setPrimaryDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sceneReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const restoredJobRef = useRef<string>("");
  const handledTerminalJobRef = useRef<string>("");
  const observedJobStatusRef = useRef<string>("");
  const userModifiedInputRef = useRef(false);

  const { data: activeJob, loading: activeJobLoading, error: activeJobError } = useAiStudioJob(authLoading ? null : (currentUser?.uid ?? null), activeJobId);
  const getToolLabel = useCallback((tool: (typeof TOOLS)[number]) => t(`dashboard.aiStudio.tools.${tool.id}.label`), [t]);
  const getLoadingMessage = useCallback((tool: (typeof TOOLS)[number]) => {
    const toolLabel = getToolLabel(tool);
    if (tool.id === "plancolor") return t("dashboard.aiStudio.processingMinutes", { tool: toolLabel });
    if (tool.id === "sceneedit") return t("dashboard.aiStudio.processingSecondsLong", { tool: toolLabel });
    if (tool.outputType === "image") return t("dashboard.aiStudio.processingSeconds", { tool: toolLabel });
    return t("dashboard.aiStudio.preparingSeconds", { tool: toolLabel });
  }, [getToolLabel, t]);
  const getSuccessMessage = useCallback((tool: (typeof TOOLS)[number]) => t("dashboard.aiStudio.toolCompleted", { tool: getToolLabel(tool) }), [getToolLabel, t]);
  const imageSourceMessages = useMemo(() => ({
    missingSource: t("dashboard.aiStudio.imageSourceMissing"),
    downloadFailed: t("dashboard.aiStudio.imageDownloadFailed"),
  }), [t]);

  const myProjects = useMemo(() => (projects || []).filter((project) => !project.isDeleted), [projects]);
  const hasPrimarySource = useMemo(() => Boolean(refImageFile || selectedFileUrl), [refImageFile, selectedFileUrl]);
  const activeSceneReferenceCount = useMemo(
    () => sceneReferences.filter((reference) => reference.file || reference.url).length,
    [sceneReferences],
  );
  const hasRequiredSceneReferences = useMemo(
    () => selectedTool?.id !== "sceneedit" || activeSceneReferenceCount > 0,
    [activeSceneReferenceCount, selectedTool?.id],
  );
  const canUndoRevision = useMemo(() => revisionCursor > 0, [revisionCursor]);
  const canRedoRevision = useMemo(() => revisionCursor >= 0 && revisionCursor < revisionSteps.length - 1, [revisionCursor, revisionSteps.length]);
  const activePromptHistory = useMemo(() => selectedTool ? (promptHistoryByTool[selectedTool.id] || []) : [], [promptHistoryByTool, selectedTool]);
  const hasActiveJobInFlight = useMemo(
    () => Boolean(activeJobId) && !activeJobError && (submittingJob || activeJobLoading || !isAiStudioJobTerminal(activeJob)),
    [activeJob, activeJobError, activeJobId, activeJobLoading, submittingJob],
  );
  const generating = useMemo(() => submittingJob || hasActiveJobInFlight, [hasActiveJobInFlight, submittingJob]);
  const activeJobTool = useMemo(() => getToolById(activeJob.toolId || activeJobDraft?.toolId || ""), [activeJob.toolId, activeJobDraft?.toolId]);
  const visibleTool = useMemo(() => activeJobTool || selectedTool, [activeJobTool, selectedTool]);

  const addPromptHistoryEntry = useCallback((entry: Partial<PromptHistoryEntry>) => {
    const safeEntry = sanitizePromptHistoryEntry(entry, resultMeta?.toolId || selectedTool?.id || "");
    if (!safeEntry) return;

    setPromptHistoryByTool((current) => {
      const toolEntries = Array.isArray(current[safeEntry.toolId]) ? current[safeEntry.toolId] : [];
      return {
        ...current,
        [safeEntry.toolId]: [safeEntry, ...toolEntries.filter((item) => item.id !== safeEntry.id)].slice(0, 8),
      };
    });

    if (!currentUser) return;
    void saveAiPromptHistorySecure(safeEntry.toolId, safeEntry).then((result) => {
      setPromptHistoryByTool((current) => ({
        ...current,
        [safeEntry.toolId]: sanitizePromptHistoryMap(result.history as Record<string, unknown>)[safeEntry.toolId] || current[safeEntry.toolId] || [],
      }));
    }).catch(() => undefined);
  }, [currentUser, resultMeta?.toolId, selectedTool?.id]);

  useEffect(() => {
    let mounted = true;
    const loadPromptHistory = async () => {
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
      }
    };
    void loadPromptHistory();
    return () => { mounted = false; };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.uid) {
      restoredJobRef.current = "";
      handledTerminalJobRef.current = "";
      observedJobStatusRef.current = "";
      const timeoutId = window.setTimeout(() => {
        setActiveJobId(null);
        setActiveJobDraft(null);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    // Skip restoration if user has already manually modified input (e.g. uploaded a new photo)
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
    const timeoutId = window.setTimeout(() => {
      // Double-check in case user modified input between effect run and timeout
      if (userModifiedInputRef.current) {
        restoredJobRef.current = "";
        return;
      }
      setActiveJobId(storedJob.jobId);
      if (storedTool) setSelectedTool(storedTool);
      if (storedJob.style) setStyle(storedJob.style);
      if (storedJob.sceneEditMode) setSceneEditMode(storedJob.sceneEditMode);
      if (storedJob.extraNote) setExtraNote(storedJob.extraNote);
      if (storedJob.sourceImageUri) {
        setSelectedFileUrl(storedJob.sourceImageUri);
        setRefImagePreview(storedJob.sourceImageUri);
        setRefImageFile(null);
      }
      setActiveJobDraft((current) => current && current.id === storedJob.jobId ? current : {
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
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [currentUser?.uid, getToolLabel]);

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

  useEffect(() => {
    if (!activeJobId && currentUser?.uid) {
      clearStoredActiveJob(currentUser.uid);
    }
  }, [activeJobId, currentUser?.uid]);

  useEffect(() => {
    if (!activeJobError) return;
    const isPermissionError = activeJobError.message?.toLowerCase().includes("permission") ||
      activeJobError.message?.toLowerCase().includes("insufficient");

    toast.error(t("dashboard.aiStudio.activeJobWatchFailed", { message: activeJobError.message }), { duration: 7000 });

    if (isPermissionError) {
      const timeoutId = window.setTimeout(() => {
        setActiveJobId(null);
        setActiveJobDraft(null);
        setJobFailureMessage(null);
        setSubmittingJob(false);
        if (currentUser?.uid) clearStoredActiveJob(currentUser.uid);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [activeJobError, currentUser?.uid, t]);

  useEffect(() => {
    if (!activeJobId || !activeJob.exists || restoredJobRef.current === activeJobId) return;
    restoredJobRef.current = activeJobId;
    const nextTool = getToolById(activeJob.toolId || activeJobDraft?.toolId || "");
    const nextSourceImageUri = activeJob.sourceImageUri || activeJobDraft?.sourceImageUri || "";
    const timeoutId = window.setTimeout(() => {
      if (nextTool) setSelectedTool(nextTool);
      if (activeJob.style) setStyle(activeJob.style);
      if (activeJob.sceneEditMode) setSceneEditMode(activeJob.sceneEditMode);
      if (activeJob.extraNote) setExtraNote(activeJob.extraNote);
      if (nextSourceImageUri && !refImagePreview) {
        setSelectedFileUrl(nextSourceImageUri);
        setRefImagePreview(nextSourceImageUri);
        setRefImageFile(null);
      }
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeJob.exists, activeJob.extraNote, activeJob.sceneEditMode, activeJob.sourceImageUri, activeJob.style, activeJob.toolId, activeJobDraft, activeJobId, refImagePreview]);

  useEffect(() => {
    if (!activeJobId || !activeJob.exists) return;
    const previousObservedStatus = observedJobStatusRef.current;
    observedJobStatusRef.current = activeJob.status;
    const finalizedTool = activeJobTool || selectedTool;
    if (!finalizedTool || !isAiStudioJobTerminal(activeJob)) return;

    const handledKey = `${activeJobId}:${activeJob.status}`;
    if (handledTerminalJobRef.current === handledKey) return;
    handledTerminalJobRef.current = handledKey;

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

    const timeoutId = window.setTimeout(() => {
      setResultMeta(metadata);
      setCompareSplit(50);
      const shouldNotifyTerminalTransition = previousObservedStatus !== ""
        && previousObservedStatus !== "completed"
        && previousObservedStatus !== "failed"
        && previousObservedStatus !== "cancelled"
        && document.visibilityState === "hidden";

      if (activeJob.status === "completed") {
        const successMessage = getSuccessMessage(finalizedTool);
        setJobFailureMessage(null);
        if (activeJob.outputType === "text") {
          setResultText(activeJob.result.text || null);
          setResultImage(null);
          setRevisionSteps([]);
          setRevisionCursor(-1);
        } else if (activeJob.result.imageUrl) {
          const completedImage = { src: activeJob.result.imageUrl, mimeType: activeJob.result.mimeType || "image/png" };
          setResultText(null);
          setResultImage(completedImage);
          setRevisionSteps([{ src: completedImage.src, mimeType: completedImage.mimeType, meta: metadata }]);
          setRevisionCursor(0);
        }
        toast.success(successMessage);
        logAiGenerationSuccess(finalizedTool.id);
        if (shouldNotifyTerminalTransition) {
          void notify({
            title: getToolLabel(finalizedTool),
            body: successMessage,
            tag: `ai-studio-job-${activeJobId}`,
          });
        }
        addPromptHistoryEntry({ ...metadata, statusLabel: successMessage });
        return;
      }

      const fallbackFailureMessage = activeJob.error?.message || t("dashboard.aiStudio.jobFailed", { tool: getToolLabel(finalizedTool) });
      setResultText(null);
      setResultImage(null);
      setRevisionSteps([]);
      setRevisionCursor(-1);
      setJobFailureMessage(fallbackFailureMessage);
      toast.error(fallbackFailureMessage, { duration: 9000 });
      if (shouldNotifyTerminalTransition) {
        void notify({
          title: getToolLabel(finalizedTool),
          body: fallbackFailureMessage,
          tag: `ai-studio-job-${activeJobId}`,
        });
      }
      addPromptHistoryEntry({ ...metadata, statusLabel: t("dashboard.aiStudio.toolFailure", { tool: getToolLabel(finalizedTool) }) });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [activeJob, activeJobDraft, activeJob.exists, activeJobId, activeJobTool, addPromptHistoryEntry, getSuccessMessage, getToolLabel, notify, selectedTool, t]);

  const selectTool = useCallback((tool: (typeof TOOLS)[number]) => {
    setSelectedTool(tool);
    setJobFailureMessage(null);
    setResultText(null);
    setResultImage(null);
    setResultMeta(null);
    setCompareSplit(50);
    setRevisionSteps([]);
    setRevisionCursor(-1);
  }, []);

  const clearRef = useCallback(() => {
    revokeObjectUrlSafe(refImagePreview);
    setRefImageFile(null);
    setRefImagePreview(null);
    setSelectedFileUrl("");
    setPrimaryDropActive(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Clear any stale job state so old results don't persist when input changes
    setActiveJobId(null);
    setActiveJobDraft(null);
    setResultImage(null);
    setResultMeta(null);
    setResultText(null);
    setJobFailureMessage(null);
    setRevisionSteps([]);
    setRevisionCursor(-1);
    if (currentUser?.uid) clearStoredActiveJob(currentUser.uid);
    userModifiedInputRef.current = true;
  }, [refImagePreview, currentUser]);

  const appendSceneReference = useCallback((file: File) => {
    const normalizedType = String(file.type || "").toLowerCase();
    if (!normalizedType.startsWith("image/") && normalizedType !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      toast.error(t("dashboard.aiStudio.referenceTypeError"));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t("dashboard.aiStudio.referenceSizeError"));
      return;
    }
    setSceneReferences((current) => {
      if (current.length >= 4) {
        toast.error(t("dashboard.aiStudio.maxReferences"));
        return current;
      }
      return [...current, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        url: "",
        label: file.name.replace(/\.[^.]+$/, ""),
        note: "",
        type: "object",
      }];
    });
  }, [t]);

  const removeSceneReference = useCallback((referenceId: string) => {
    setSceneReferences((current) => current.filter((reference) => reference.id !== referenceId));
  }, []);

  const handlePrimaryFileSelection = useCallback((file: File) => {
    if (!file) return;
    const normalizedType = String(file.type || "").toLowerCase();
    const isImage = normalizedType.startsWith("image/");
    const isPdf = normalizedType === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isImage && !isPdf) {
      toast.error(t("dashboard.aiStudio.primaryTypeError"));
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t("dashboard.aiStudio.primarySizeError"));
      return;
    }
    clearRef();
    setRefImageFile(file);
    setSelectedFileUrl("");
    revokeObjectUrlSafe(refImagePreview);
    setRefImagePreview(isPdf ? null : URL.createObjectURL(file));
  }, [clearRef, refImagePreview, t]);

  const handlePrimaryDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setPrimaryDropActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handlePrimaryFileSelection(file);
  }, [handlePrimaryFileSelection]);

  const handleDownloadCurrentResult = useCallback(async () => {
    if (!resultImage?.src) return;
    const { mimeType, ext } = getMimeAndExtFromImageSource(resultImage.src, resultImage.mimeType || "image/png");
    const fileName = ensureFileExtension(buildDefaultAiFileName(resultMeta?.toolId || selectedTool?.id || "ai"), ext);
    try {
      if (isDataUrl(resultImage.src)) {
        const anchor = document.createElement("a");
        anchor.href = resultImage.src;
        anchor.download = fileName;
        anchor.click();
      } else {
        const outputFile = await imageSourceToFile(resultImage.src, fileName, resultImage.mimeType || mimeType, imageSourceMessages);
        const objectUrl = URL.createObjectURL(outputFile);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = fileName;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      }
      toast.success(t("dashboard.aiStudio.downloaded", { mimeType }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.aiStudio.downloadFailed"));
    }
  }, [imageSourceMessages, resultImage, resultMeta, selectedTool, t]);

  const applyPromptHistory = useCallback((entry: PromptHistoryEntry) => {
    const tool = TOOLS.find((item) => item.id === entry.toolId);
    if (!tool) return;
    selectTool(tool);
    requestAnimationFrame(() => {
      if (entry.style) setStyle(entry.style);
      if (entry.sceneEditMode) setSceneEditMode(entry.sceneEditMode);
      setExtraNote(entry.extraNote || "");
    });
    toast.success(t("dashboard.aiStudio.promptRestored"));
  }, [selectTool, t]);

  const applyRevisionStep = useCallback((stepIndex: number) => {
    const step = revisionSteps[stepIndex];
    if (!step) return;
    setResultImage({ src: step.src, mimeType: step.mimeType });
    setResultMeta(step.meta);
    setCompareSplit(50);
    setRevisionCursor(stepIndex);
  }, [revisionSteps]);

  const handleUndo = useCallback(() => {
    if (!canUndoRevision) return;
    applyRevisionStep(revisionCursor - 1);
  }, [applyRevisionStep, canUndoRevision, revisionCursor]);

  const handleRedo = useCallback(() => {
    if (!canRedoRevision) return;
    applyRevisionStep(revisionCursor + 1);
  }, [applyRevisionStep, canRedoRevision, revisionCursor]);

  const useResultAsPrimaryScene = useCallback(() => {
    if (!resultImage?.src) return;
    revokeObjectUrlSafe(refImagePreview);
    setRefImageFile(null);
    setSelectedFileUrl(resultImage.src);
    setRefImagePreview(resultImage.src);
    toast.success(t("dashboard.aiStudio.primarySceneAssigned"));
  }, [refImagePreview, resultImage, t]);

  const handleNativeShare = useCallback(async () => {
    if (!resultImage?.src) return;
    if (!navigator.share) {
      await handleDownloadCurrentResult();
      return;
    }
    setSharing(true);
    try {
      const { ext } = getMimeAndExtFromImageSource(resultImage.src, resultImage.mimeType || "image/png");
      const fileName = ensureFileExtension(buildDefaultAiFileName(resultMeta?.toolId || selectedTool?.id || "ai"), ext);
      const shareFile = await imageSourceToFile(resultImage.src, fileName, resultImage.mimeType || "image/png", imageSourceMessages);
      if (!navigator.canShare?.({ files: [shareFile] })) {
        await handleDownloadCurrentResult();
        return;
      }
      await navigator.share({
        title: `Archilya AI · ${selectedTool ? getToolLabel(selectedTool) : t("dashboard.aiStudio.visualOutput")}`,
        files: [shareFile],
      });
      toast.success(t("dashboard.aiStudio.shareOpened"));
    } catch (error) {
      if ((error as { name?: string })?.name !== "AbortError") {
        toast.error(t("dashboard.aiStudio.shareFailed"));
      }
    } finally {
      setSharing(false);
    }
  }, [getToolLabel, handleDownloadCurrentResult, imageSourceMessages, resultImage, resultMeta, selectedTool, t]);

  const handleSaveResultToProject = useCallback(async () => {
    if (!resultImage?.src) {
      toast.error(t("dashboard.aiStudio.saveMissing"));
      return;
    }
    if (!myProjects.length) {
      toast.error(t("dashboard.aiStudio.createProjectFirst"));
      return;
    }
    const targetProject = myProjects[0] as ProjectRecord;
    setSaving(true);
    try {
      const { ext } = getMimeAndExtFromImageSource(resultImage.src, resultImage.mimeType || "image/png");
      const fileName = ensureFileExtension(buildDefaultAiFileName(resultMeta?.toolId || selectedTool?.id || "ai"), ext);
      const outputFile = await imageSourceToFile(resultImage.src, fileName, resultImage.mimeType || "image/png", imageSourceMessages);
      await uploadProjectFiles(targetProject, [outputFile], currentUser?.uid || "", ownerName);
      await refreshProjects();
      await updatePoolStorage(outputFile.size).catch(() => undefined);
      toast.success(t("dashboard.aiStudio.savedToProject", { projectName: targetProject.name }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.aiStudio.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [currentUser, imageSourceMessages, myProjects, ownerName, refreshProjects, resultImage, resultMeta, selectedTool, t, updatePoolStorage]);

  const handleGenerate = useCallback(async (options: { extraNoteOverride?: string; generationVariant?: string } = {}) => {
    if (!selectedTool) return;
    if (!hasPrimarySource) {
      toast.error(selectedTool.id === "sceneedit" ? t("dashboard.aiStudio.mainSceneRequired") : t("dashboard.aiStudio.referenceRequiredToast"));
      return;
    }
    if (selectedTool.id === "sceneedit" && !hasRequiredSceneReferences) {
      toast.error(t("dashboard.aiStudio.sceneReferenceRequiredToast"));
      return;
    }
    if (!hasEnough(selectedTool.credit)) {
      toast.error(t("dashboard.aiStudio.creditRequiredToast", { credit: selectedTool.credit }), { duration: 4000 });
      return;
    }

    void requestPermission();

    const effectiveExtraNote = String(options.extraNoteOverride ?? extraNote ?? "").trim();
    const generationVariant = String(options.generationVariant || "default");

    setResultText(null);
    setResultImage(null);
    setResultMeta(null);
    setJobFailureMessage(null);
    setCompareSplit(50);
    setRevisionSteps([]);
    setRevisionCursor(-1);

    const isImage = selectedTool.outputType === "image";
    const toastId = toast.loading(getLoadingMessage(selectedTool));

    try {
      setSubmittingJob(true);
      const activeReferences = selectedTool.id === "sceneedit"
        ? sceneReferences
            .filter((reference) => reference.file || reference.url)
            .slice(0, 4)
            .map((reference) => ({
              type: reference.type,
              label: reference.label,
              note: reference.note,
              file: reference.file || null,
              url: reference.url || "",
            }))
        : [];

      const nextJobDraft: ActiveJobDraft = {
        id: "",
        toolId: selectedTool.id,
        toolLabel: getToolLabel(selectedTool),
        outputType: selectedTool.outputType,
        style: selectedTool.hasStyle ? style : "",
        sceneEditMode: selectedTool.id === "sceneedit" ? sceneEditMode : "",
        referenceCount: activeReferences.length,
        extraNote: effectiveExtraNote,
        generationVariant,
        createdAt: new Date().toISOString(),
        sourceImageUri: selectedFileUrl || refImagePreview || "",
      };

      const { jobId } = await queueAiStudioJob({
        toolId: selectedTool.id,
        imageFile: refImageFile || null,
        imageUrl: selectedFileUrl || null,
        style,
        extraNote: effectiveExtraNote,
        sceneEditMode,
        generationVariant,
        references: activeReferences,
      });

      const persistedDraft = { ...nextJobDraft, id: jobId };
      handledTerminalJobRef.current = "";
      observedJobStatusRef.current = "queued";
      restoredJobRef.current = "";
      setActiveJobId(jobId);
      setActiveJobDraft(persistedDraft);
      setResultMeta(persistedDraft);

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
          await createActivityLogEntry(getFirebaseFirestore(), {
            workspaceId: activeWorkspace.id,
            category: "ai",
            action: "aiJobQueued",
            actorUid: currentUser.uid,
            actorEmail: currentUser.email || "",
            actorName: currentUser.displayName || currentUser.email || t("common.user"),
            targetType: "ai_job",
            targetId: jobId,
            targetName: getToolLabel(selectedTool),
            metadata: { toolId: selectedTool.id, creditCost: selectedTool.credit },
            timestamp: null,
          });
        } catch {
          // Silently fail
        }
      }

      toast.success(t("dashboard.aiStudio.queuedToast", { tool: getToolLabel(selectedTool) }), { id: toastId });
    } catch (error) {
      toast.error(getFriendlyAIError(error, isImage, {
        permissionImage: t("dashboard.aiStudio.aiAuthorizationError"),
        permissionAnalysis: t("dashboard.aiStudio.aiAnalysisAuthorizationError"),
        generic: t("errors.generic"),
      }), { id: toastId, duration: 9000 });
    } finally {
      setSubmittingJob(false);
    }
  }, [activeWorkspace, currentUser, extraNote, getLoadingMessage, getToolLabel, hasEnough, hasPrimarySource, hasRequiredSceneReferences, refImageFile, refImagePreview, requestPermission, sceneEditMode, sceneReferences, selectedFileUrl, selectedTool, style, t]);

  const runVariation = useCallback(() => {
    const baseNote = String(extraNote || "").trim();
    const variationNote = baseNote ? `${baseNote}\n\n${VARIATION_NOTE_SUFFIX}` : VARIATION_NOTE_SUFFIX;
    void handleGenerate({ extraNoteOverride: variationNote, generationVariant: "variation" });
  }, [extraNote, handleGenerate]);

  const handleFeedback = useCallback(async (feedback: AiStudioJobFeedback) => {
    if (!currentUser?.uid || !activeJobId) return;
    try {
      await saveAiJobFeedback(currentUser.uid, activeJobId, feedback);
      toast.success(feedback === "positive" ? t("dashboard.aiStudio.feedbackPositive") : t("dashboard.aiStudio.feedbackNegative"));
    } catch {
      toast.error(t("dashboard.aiStudio.feedbackFailed"));
    }
  }, [activeJobId, currentUser, t]);

  const handleGeneratePromptInspiration = useCallback(async () => {
    if (!selectedTool) return;
    if (!hasPrimarySource) {
      toast.error(t("dashboard.aiStudio.referenceRequiredToast"));
      return;
    }
    if (!["img2img", "enhance", "plancolor"].includes(selectedTool.id)) {
      toast.error(t("dashboard.aiStudio.unsupportedToolForInspiration"));
      return;
    }

    setGeneratingPromptInspiration(true);
    try {
      const { text } = await generatePromptInspiration({
        imageFile: refImageFile,
        imageUrl: selectedFileUrl,
        style: selectedTool.hasStyle || selectedTool.id === "enhance" ? style : "modern",
        targetTool: selectedTool.id,
      });
      setExtraNote(text);
      toast.success(t("dashboard.aiStudio.promptInspirationSuccess"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("dashboard.aiStudio.promptInspirationFailed"));
    } finally {
      setGeneratingPromptInspiration(false);
    }
  }, [hasPrimarySource, refImageFile, selectedFileUrl, selectedTool, style, t]);

  const auth = useMemo(() => ({ currentUser, ownerName }), [currentUser, ownerName]);
  const creditsGroup = useMemo(() => ({ credits, hasEnough }), [credits, hasEnough]);
  const projectsGroup = useMemo(() => ({ myProjects, refreshProjects }), [myProjects, refreshProjects]);
  const workspace = useMemo(() => ({ updatePoolStorage }), [updatePoolStorage]);
  const state = useMemo(() => ({
    selectedTool,
    refImageFile,
    refImagePreview,
    selectedFileUrl,
    style,
    extraNote,
    submittingJob,
    generatingPromptInspiration,
    activeJobId,
    activeJobDraft,
    jobFailureMessage,
    resultText,
    resultImage,
    resultMeta,
    compareSplit,
    sceneEditMode,
    sceneReferences,
    promptHistoryByTool,
    revisionSteps,
    revisionCursor,
    saving,
    sharing,
    primaryDropActive,
  }), [
    activeJobDraft,
    activeJobId,
    compareSplit,
    extraNote,
    generatingPromptInspiration,
    jobFailureMessage,
    primaryDropActive,
    promptHistoryByTool,
    refImageFile,
    refImagePreview,
    resultImage,
    resultMeta,
    resultText,
    revisionCursor,
    revisionSteps,
    saving,
    sceneEditMode,
    sceneReferences,
    selectedFileUrl,
    selectedTool,
    sharing,
    style,
    submittingJob,
  ]);
  const refs = useMemo(() => ({
    fileInputRef,
    sceneReferenceInputRef,
  }), []);
  const computed = useMemo(() => ({
    hasPrimarySource,
    activeSceneReferenceCount,
    hasRequiredSceneReferences,
    canUndoRevision,
    canRedoRevision,
    activePromptHistory,
    hasActiveJobInFlight,
    generating,
    activeJobTool,
    visibleTool,
  }), [
    activeJobTool,
    activePromptHistory,
    activeSceneReferenceCount,
    canRedoRevision,
    canUndoRevision,
    generating,
    hasActiveJobInFlight,
    hasPrimarySource,
    hasRequiredSceneReferences,
    visibleTool,
  ]);
  const job = useMemo(() => ({
    activeJob,
    activeJobLoading,
    activeJobError,
  }), [activeJob, activeJobError, activeJobLoading]);
  const actions = useMemo(() => ({
    selectTool,
    clearRef,
    appendSceneReference,
    removeSceneReference,
    handlePrimaryFileSelection,
    handlePrimaryDrop,
    handleGenerate,
    handleDownloadCurrentResult,
    applyPromptHistory,
    handleUndo,
    handleRedo,
    useResultAsPrimaryScene,
    runVariation,
    handleNativeShare,
    handleSaveResultToProject,
    handleFeedback,
    handleGeneratePromptInspiration,
  }), [
    appendSceneReference,
    applyPromptHistory,
    clearRef,
    handleDownloadCurrentResult,
    handleFeedback,
    handleGeneratePromptInspiration,
    handleGenerate,
    handleNativeShare,
    handlePrimaryDrop,
    handlePrimaryFileSelection,
    handleRedo,
    handleSaveResultToProject,
    handleUndo,
    removeSceneReference,
    runVariation,
    selectTool,
    useResultAsPrimaryScene,
  ]);
  const setters = useMemo(() => ({
    setStyle,
    setExtraNote,
    setSceneEditMode,
    setCompareSplit,
    setPrimaryDropActive,
    setResultText,
    setResultImage,
    setSelectedFileUrl,
    setRefImagePreview,
    setRefImageFile,
  }), []);

  return useMemo(() => ({
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
  }), [actions, auth, computed, creditsGroup, job, projectsGroup, refs, setters, state, workspace]);
}
