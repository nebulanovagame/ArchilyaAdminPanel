import {
  isAiStudioJobTerminal,
  normalizeAiStudioJobStatus,
} from "@/lib/ai-studio/job-contract";

import type {
  ActiveJobDraft,
  PromptHistoryEntry,
  ResultRevisionStep,
  SceneReference,
  ToolConfig,
} from "../types";
import { getToolById } from "../utils";

export type ActiveJobInfo = {
  status: string;
  progressMessage?: string;
  toolId?: string;
  style?: string;
  sceneEditMode?: string;
  extraNote?: string;
  outputType?: "text" | "image";
  sourceImageUri?: string;
  error?: { message?: string } | null;
  exists: boolean;
  result?: { imageUrl?: string; mimeType?: string; text?: string };
  completedAt?: string | unknown;
  updatedAt?: string | unknown;
  createdAt?: string | unknown;
  referenceCount?: number;
};

export type DerivationInput = {
  refImageFile: File | null;
  selectedFileUrl: string;
  sceneReferences: SceneReference[];
  selectedTool: ToolConfig | null;
  activeJobId: string | null;
  activeJob: ActiveJobInfo;
  submittingJob: boolean;
  activeJobLoading: boolean;
  activeJobError: unknown;
  activeJobDraft: ActiveJobDraft | null;
  revisionCursor: number;
  revisionSteps: ResultRevisionStep[];
  promptHistoryByTool: Record<string, PromptHistoryEntry[]>;
};

export type DerivedState = {
  hasPrimarySource: boolean;
  activeSceneReferenceCount: number;
  hasRequiredSceneReferences: boolean;
  canUndoRevision: boolean;
  canRedoRevision: boolean;
  activePromptHistory: PromptHistoryEntry[];
  hasActiveJobInFlight: boolean;
  generating: boolean;
  activeJobTool: ToolConfig | null;
  visibleTool: ToolConfig | null;
};

export function deriveAiStudioState(input: DerivationInput): DerivedState {
  const hasPrimarySource = Boolean(input.refImageFile || input.selectedFileUrl);
  const activeSceneReferenceCount = input.sceneReferences.filter((ref) => ref.file || ref.url).length;
  const hasRequiredSceneReferences = input.selectedTool?.id !== "sceneedit" || activeSceneReferenceCount > 0;
  const canUndoRevision = input.revisionCursor > 0;
  const canRedoRevision = input.revisionCursor >= 0 && input.revisionCursor < input.revisionSteps.length - 1;
  const activePromptHistory = input.selectedTool ? (input.promptHistoryByTool[input.selectedTool.id] || []) : [];
  const hasActiveJobInFlight =
    Boolean(input.activeJobId) &&
    !input.activeJobError &&
    (input.submittingJob ||
      input.activeJobLoading ||
      !isAiStudioJobTerminal({
        status: normalizeAiStudioJobStatus(input.activeJob.status),
      }));
  const generating = input.submittingJob || hasActiveJobInFlight;
  const activeJobTool = getToolById(input.activeJob.toolId || input.activeJobDraft?.toolId || "");
  const visibleTool = activeJobTool || input.selectedTool;

  return {
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
  };
}
