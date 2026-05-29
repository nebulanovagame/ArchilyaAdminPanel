"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAiStudioFileOps } from "./use-ai-studio-file-ops";
import type {
  ResultImage,
  ResultMeta,
  ResultRevisionStep,
} from "../types";
import type { ProjectRecord } from "@/lib/projects/types";

export interface ResultDeps {
  currentUser: { uid: string; email: string | null } | null;
  ownerName: string;
  imageSourceMessages: { missingSource: string; downloadFailed: string };
  myProjects: ProjectRecord[];
  refreshProjects: () => void | Promise<void>;
  updatePoolStorage: (bytes: number) => Promise<void>;
}

/** LocalStorage key for persisting hidden result across page refreshes. */
const LAST_RESULT_STORAGE_KEY = "archilya:ai-studio:last-result:v1";

type PersistedLastResult = {
  resultImage: ResultImage | null;
  resultText: string | null;
  resultMeta: ResultMeta | null;
  revisionSteps: ResultRevisionStep[];
  revisionCursor: number;
  compareSplit: number;
};

/** Safely read last result from localStorage. Returns null if missing or corrupted. */
function readLastResultFromStorage(uid: string): PersistedLastResult | null {
  try {
    const raw = localStorage.getItem(`${LAST_RESULT_STORAGE_KEY}:${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedLastResult;
    // Basic shape validation
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.revisionSteps)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist last result to localStorage so page refresh doesn't lose hidden results. */
function writeLastResultToStorage(uid: string, data: PersistedLastResult | null) {
  try {
    if (data) {
      localStorage.setItem(`${LAST_RESULT_STORAGE_KEY}:${uid}`, JSON.stringify(data));
    } else {
      localStorage.removeItem(`${LAST_RESULT_STORAGE_KEY}:${uid}`);
    }
  } catch {
    // localStorage full or unavailable — silently skip persistence
  }
}

/**
 * useAiStudioResult
 *
 * Owns all result display state including revision history, undo/redo,
 * and file operations (download, share, save).
 *
 * CRITICAL UX FIX: close() hides the result instead of deleting it,
 * so users can reopen it without regenerating. The hidden result is
 * also persisted to localStorage so page refreshes don't lose it.
 */
export function useAiStudioResult(deps: ResultDeps) {
  const uid = deps.currentUser?.uid ?? "";

  // ── Live result state ──────────────────────────────────────
  const [resultImage, setResultImageState] = useState<ResultImage | null>(null);
  const [resultText, setResultText] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<ResultMeta | null>(null);
  const [compareSplit, setCompareSplit] = useState(50);

  // ── Revision history ──────────────────────────────────────
  const [revisionSteps, setRevisionSteps] = useState<ResultRevisionStep[]>([]);
  const [revisionCursor, setRevisionCursor] = useState(-1);

  // ── File operation UI state ────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  // ── Result persistence (close = hide) ─────────────────────
  // Preserve the last result so it can be restored without regenerating.
  const [lastResult, setLastResult] = useState<PersistedLastResult | null>(
    () => (uid ? readLastResultFromStorage(uid) : null),
  );

  // Tool label for file ops
  const [resultToolLabel, setResultToolLabel] = useState<string | null>(null);

  const { handleDownloadCurrentResult, handleNativeShare, handleSaveResultToProject } =
    useAiStudioFileOps(resultImage, resultMeta, resultToolLabel, {
      currentUser: deps.currentUser,
      ownerName: deps.ownerName,
      imageSourceMessages: deps.imageSourceMessages,
      myProjects: deps.myProjects,
      refreshProjects: deps.refreshProjects,
      updatePoolStorage: deps.updatePoolStorage,
      setSaving,
      setSharing,
    });

  // ── Public setter that preserves last result ───────────────
  const setResultAndMeta = useCallback(
    (
      image: ResultImage | null,
      text: string | null,
      meta: ResultMeta | null,
      toolLabel: string | null,
    ) => {
      // Archive current result before overwriting
      if (resultImage || resultText) {
        setLastResult({
          resultImage,
          resultText,
          resultMeta,
          revisionSteps,
          revisionCursor,
          compareSplit,
        });
      }
      setResultImageState(image);
      setResultText(text);
      setResultMeta(meta);
      setResultToolLabel(toolLabel);
      // Reset revision tracking for new result
      setRevisionSteps(image ? [{ src: image.src, mimeType: image.mimeType, meta }] : []);
      setRevisionCursor(image ? 0 : -1);
      setCompareSplit(50);
    },
    [resultImage, resultText, resultMeta, revisionSteps, revisionCursor, compareSplit],
  );

  // ── Persist lastResult to localStorage whenever it changes ──
  const wasWrittenRef = useRef(false);
  useEffect(() => {
    if (!uid) return;
    writeLastResultToStorage(uid, lastResult);
    wasWrittenRef.current = true;
  }, [uid, lastResult]);

  // ── Close hides, does NOT delete ───────────────────────────
  const hideResult = useCallback(() => {
    if (resultImage || resultText) {
      // Save current to lastResult before hiding — includes FULL revision history
      setLastResult({
        resultImage,
        resultText,
        resultMeta,
        revisionSteps,
        revisionCursor,
        compareSplit,
      });
    }
    setResultImageState(null);
    setResultText(null);
  }, [resultImage, resultText, resultMeta, revisionSteps, revisionCursor, compareSplit]);

  /** Restore the hidden/last result (if any) — with full revision history */
  const restoreLastResult = useCallback(() => {
    if (!lastResult) return;
    setResultImageState(lastResult.resultImage);
    setResultText(lastResult.resultText);
    setResultMeta(lastResult.resultMeta);
    setRevisionSteps(lastResult.revisionSteps);
    setRevisionCursor(lastResult.revisionCursor);
    setCompareSplit(lastResult.compareSplit);
    setLastResult(null);
    // Clear localStorage backup since it's restored
    if (uid) writeLastResultToStorage(uid, null);
  }, [lastResult, uid]);

  const hasHiddenResult = lastResult !== null;

  // ── Revision navigation ────────────────────────────────────
  const applyRevisionStep = useCallback(
    (stepIndex: number) => {
      const step = revisionSteps[stepIndex];
      if (!step) return;
      setResultImageState({ src: step.src, mimeType: step.mimeType });
      setResultMeta(step.meta);
      setCompareSplit(50);
      setRevisionCursor(stepIndex);
    },
    [revisionSteps],
  );

  const canUndoRevision = revisionCursor > 0;
  const canRedoRevision =
    revisionCursor >= 0 && revisionCursor < revisionSteps.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndoRevision) return;
    applyRevisionStep(revisionCursor - 1);
  }, [applyRevisionStep, canUndoRevision, revisionCursor]);

  const handleRedo = useCallback(() => {
    if (!canRedoRevision) return;
    applyRevisionStep(revisionCursor + 1);
  }, [applyRevisionStep, canRedoRevision, revisionCursor]);

  // ── Use result as primary scene ────────────────────────────
  const useResultAsPrimaryScene = useCallback(() => {
    if (!resultImage?.src) return;
    // This just returns the URL — the caller (facade) handles
    // setting the primary source since it cross-cuts state boundaries.
    return resultImage.src;
  }, [resultImage]);

  return {
    // State
    resultImage,
    resultText,
    resultMeta,
    compareSplit,
    revisionSteps,
    revisionCursor,
    saving,
    sharing,

    // Derived
    canUndoRevision,
    canRedoRevision,
    hasHiddenResult,

    // Primary setter (used by job lifecycle)
    setResultAndMeta,

    // Setters (for external use)
    setResultImage: setResultImageState,
    setResultText,
    setResultMeta,
    setCompareSplit,
    setRevisionSteps,
    setRevisionCursor,
    setSaving,
    setSharing,
    setResultToolLabel,

    // Actions
    hideResult,
    restoreLastResult,
    applyRevisionStep,
    handleUndo,
    handleRedo,
    useResultAsPrimaryScene,

    // File ops (delegated to useAiStudioFileOps)
    handleDownloadCurrentResult,
    handleNativeShare,
    handleSaveResultToProject,
  };
}

export type UseAiStudioResultReturn = ReturnType<typeof useAiStudioResult>;
