"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { Annotation, Constraint, MarkupTool } from "@/lib/types/markup";

type MarkupContextValue = {
  annotations: Annotation[];
  constraints: Constraint[];
  activeSceneId: string | null;
  selectedTool: MarkupTool;
  color: string;
  strokeWidth: number;
  isProcessing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  addAnnotation: (annotation: Annotation, sceneId: string) => void;
  removeAnnotation: (annotationId: string) => void;
  undoAnnotation: () => void;
  redoAnnotation: () => void;
  updateConstraint: (annotationId: string, updates: Partial<Constraint>) => void;
  setConstraints: (constraints: Constraint[]) => void;
  setActiveSceneId: (sceneId: string | null) => void;
  setSelectedTool: (tool: MarkupTool) => void;
  setColor: (color: string) => void;
  setStrokeWidth: (strokeWidth: number) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  resetMarkup: () => void;
};

type MarkupSnapshot = {
  annotations: Annotation[];
  constraints: Constraint[];
};

const MARKUP_DRAFT_STORAGE_KEY = "archilya-render-markup-draft";

type PersistedMarkupDraft = {
  annotations: Annotation[];
  constraints: Constraint[];
  activeSceneId: string | null;
  selectedTool: MarkupTool;
  color: string;
  strokeWidth: number;
};

const MarkupContext = createContext<MarkupContextValue | null>(null);

function readPersistedDraft(): PersistedMarkupDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(MARKUP_DRAFT_STORAGE_KEY);
    return rawDraft ? (JSON.parse(rawDraft) as PersistedMarkupDraft) : null;
  } catch {
    return null;
  }
}

function buildConstraint(annotation: Annotation, sceneId: string): Constraint {
  return {
    id: `constraint-${annotation.id}`,
    annotationId: annotation.id,
    sceneId,
    type: "CHANGE",
    targetArea: annotation.label ?? annotation.type,
    description: "",
    confidence: 0.8,
  };
}

export function MarkupProvider({ children }: { children: ReactNode }) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [constraints, setConstraintsState] = useState<Constraint[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<MarkupTool>("freehand");
  const [color, setColor] = useState("#FF4757");
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [isProcessing, setIsProcessing] = useState(false);
  const [undoStack, setUndoStack] = useState<MarkupSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<MarkupSnapshot[]>([]);

  useEffect(() => {
    const draft = readPersistedDraft();
    if (!draft) return;
    startTransition(() => {
      if (draft.annotations?.length) setAnnotations(draft.annotations);
      if (draft.constraints?.length) setConstraintsState(draft.constraints);
      if (draft.activeSceneId) setActiveSceneId(draft.activeSceneId);
      if (draft.selectedTool) setSelectedTool(draft.selectedTool);
      if (draft.color) setColor(draft.color);
      if (draft.strokeWidth) setStrokeWidth(draft.strokeWidth);
    });
  }, []);

  useEffect(() => {
    const draft: PersistedMarkupDraft = {
      annotations,
      constraints,
      activeSceneId,
      selectedTool,
      color,
      strokeWidth,
    };

    try {
      window.localStorage.setItem(MARKUP_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors.
    }
  }, [activeSceneId, annotations, color, constraints, selectedTool, strokeWidth]);

  const pushUndoSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev, { annotations, constraints }].slice(-30));
    setRedoStack([]);
  }, [annotations, constraints]);

  const addAnnotation = useCallback((annotation: Annotation, sceneId: string) => {
    pushUndoSnapshot();
    setAnnotations((prev) => [...prev, annotation]);
    setConstraintsState((prev) => [...prev, buildConstraint(annotation, sceneId)]);
  }, [pushUndoSnapshot]);

  const removeAnnotation = useCallback((annotationId: string) => {
    pushUndoSnapshot();
    setAnnotations((prev) => prev.filter((annotation) => annotation.id !== annotationId));
    setConstraintsState((prev) => prev.filter((constraint) => constraint.annotationId !== annotationId));
  }, [pushUndoSnapshot]);

  const undoAnnotation = useCallback(() => {
    const previous = undoStack.at(-1);
    if (!previous) return;

    setRedoStack((prev) => [...prev, { annotations, constraints }].slice(-30));
    setAnnotations(previous.annotations);
    setConstraintsState(previous.constraints);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [annotations, constraints, undoStack]);

  const redoAnnotation = useCallback(() => {
    const next = redoStack.at(-1);
    if (!next) return;

    setUndoStack((prev) => [...prev, { annotations, constraints }].slice(-30));
    setAnnotations(next.annotations);
    setConstraintsState(next.constraints);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [annotations, constraints, redoStack]);

  const updateConstraint = useCallback((annotationId: string, updates: Partial<Constraint>) => {
    pushUndoSnapshot();
    setConstraintsState((prev) =>
      prev.map((constraint) =>
        constraint.annotationId === annotationId ? { ...constraint, ...updates } : constraint,
      ),
    );
  }, [pushUndoSnapshot]);

  const setConstraints = useCallback((nextConstraints: Constraint[]) => {
    pushUndoSnapshot();
    setConstraintsState(nextConstraints);
  }, [pushUndoSnapshot]);

  const resetMarkup = useCallback(() => {
    setAnnotations([]);
    setConstraintsState([]);
    setActiveSceneId(null);
    setSelectedTool("freehand");
    setColor("#FF4757");
    setStrokeWidth(4);
    setIsProcessing(false);
    setUndoStack([]);
    setRedoStack([]);

    try {
      window.localStorage.removeItem(MARKUP_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const value = useMemo<MarkupContextValue>(
    () => ({
      annotations,
      constraints,
      activeSceneId,
      selectedTool,
      color,
      strokeWidth,
      isProcessing,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
      addAnnotation,
      removeAnnotation,
      undoAnnotation,
      redoAnnotation,
      updateConstraint,
      setConstraints,
      setActiveSceneId,
      setSelectedTool,
      setColor,
      setStrokeWidth,
      setIsProcessing,
      resetMarkup,
    }),
    [
      annotations,
      constraints,
      activeSceneId,
      selectedTool,
      color,
      strokeWidth,
      isProcessing,
      undoStack.length,
      redoStack.length,
      addAnnotation,
      removeAnnotation,
      undoAnnotation,
      redoAnnotation,
      updateConstraint,
      setConstraints,
      resetMarkup,
    ],
  );

  return <MarkupContext.Provider value={value}>{children}</MarkupContext.Provider>;
}

export function useMarkupContext() {
  const context = useContext(MarkupContext);
  if (!context) {
    throw new Error("useMarkupContext must be used within a MarkupProvider.");
  }
  return context;
}
