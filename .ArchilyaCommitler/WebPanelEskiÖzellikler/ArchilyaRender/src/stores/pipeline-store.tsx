"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { doc, onSnapshot, type Unsubscribe } from "firebase/firestore";

import type { AgentRole, AgentState, JobState, PipelineStage } from "@/lib/types/agent";
import type { Scene, MaterialRef, Moodboard, LightPreference } from "@/lib/types/scene";
import {
  requestRenderRevision,
  type JobDocument,
} from "@/lib/ai-studio/render-pipeline";
import { useRenderJob } from "@/hooks/use-render-job";
import { useAiStudioJob } from "@/hooks/use-ai-studio-job";
import { useCredits } from "@/hooks/use-credits";
import { useAuth } from "@/components/providers/auth-provider";
import { queueAiStudioJob } from "@/services/nano-banana-service";
import { AI_STUDIO_JOB_SUBCOLLECTION, mapAiStudioJobSnapshot, type AiStudioJobDocument } from "@/lib/ai-studio/job-contract";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";

export type PipelineInput = {
  scenes: Scene[];
  materials: MaterialRef[];
  moodboards: Moodboard[];
  lightPreference: LightPreference | null;
};

type PipelineContextValue = {
  jobState: JobState | null;
  isRunning: boolean;
  awaitingApproval: boolean;
  approvalStageId: PipelineStage["id"] | null;
  activeJobId: string | null;
  activeJobIds: string[];
  startPipeline: (input: PipelineInput) => Promise<void>;
  approveStage: () => void;
  requestRevision: (feedback: string, stageId?: PipelineStage["id"]) => Promise<void>;
  resetPipeline: () => void;
  outputImageUrl: string | null;
  outputImageUrls: string[];
  pipelineError: string | null;
};

function getPipelineErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const record = error as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : fallback;
  const code = typeof record.code === "string" ? record.code : "";
  const details = typeof record.details === "string" ? record.details : "";

  return [code, message, details].filter(Boolean).join(" — ");
}

const agentRoles: AgentRole[] = ["ORCHESTRATOR", "ANALYST", "MATERIAL", "RENDER", "QC", "REVISION"];

const PIPELINE_DRAFT_STORAGE_KEY = "archilya-render-pipeline-draft";
const RENDER_PIPELINE_CREDIT_COST = 50;
const JOB_DISCOVERY_TIMEOUT_MS = 90_000;
const JOB_PROGRESS_TIMEOUT_MS = 10 * 60_000;

type PersistedPipelineDraft = {
  jobState: JobState | null;
  isRunning: boolean;
  awaitingApproval: boolean;
  approvalStageId: PipelineStage["id"] | null;
  activeJobId: string | null;
  activeJobIds: string[];
  outputImageUrl: string | null;
  outputImageUrls: string[];
  pipelineError: string | null;
};

const initialStages: PipelineStage[] = [
  { id: 1, name: "Scene Analysis", description: "Reading the scene, scale, and goals", status: "PENDING" },
  { id: 2, name: "Material Matching", description: "Surface and reference material decisions", status: "PENDING" },
  { id: 3, name: "Render Pass", description: "AI render production pipeline", status: "PENDING" },
  { id: 4, name: "Quality Gate", description: "QC and final approval check", status: "PENDING" },
];

function buildAgents(): AgentState[] {
  return agentRoles.map((role) => ({ role, status: "IDLE", progress: 0, messages: [] }));
}

function buildJob(): JobState {
  const startedAt = Date.now();
  return {
    jobId: `job-${startedAt}`,
    sessionId: `session-${startedAt}`,
    stages: initialStages,
    agents: buildAgents(),
    currentStageId: 1,
    overallProgress: 0,
    startedAt,
  };
}

function markPipelineFailed(job: JobState, message: string): JobState {
  return {
    ...job,
    stages: job.stages.map((stage) =>
      stage.id === job.currentStageId
        ? { ...stage, status: "REJECTED" }
        : stage,
    ),
    agents: job.agents.map((agent) =>
      agent.role === "ORCHESTRATOR"
        ? {
            ...agent,
            status: "ERROR",
            currentTask: message,
            messages: [
              ...agent.messages,
              {
                agentRole: "ORCHESTRATOR",
                content: message,
                timestamp: Date.now(),
                type: "error",
              },
            ],
          }
        : agent,
    ),
  };
}

const PipelineContext = createContext<PipelineContextValue | null>(null);

function readPersistedDraft(): PersistedPipelineDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(PIPELINE_DRAFT_STORAGE_KEY);
    return rawDraft ? (JSON.parse(rawDraft) as PersistedPipelineDraft) : null;
  } catch {
    return null;
  }
}

function mapJobToPipelineStage(job: JobDocument): PipelineStage["id"] | null {
  if (!job.stage || job.status === "pending") return 1;
  if (job.stage >= 1 && job.stage <= 4) return job.stage as PipelineStage["id"];
  return null;
}

function getAgentRoleForStage(stageId: PipelineStage["id"]): AgentRole {
  switch (stageId) {
    case 1: return "ANALYST";
    case 2: return "MATERIAL";
    case 3: return "RENDER";
    case 4: return "QC";
    default: return "ORCHESTRATOR";
  }
}

function buildPipelinePrompt(input: PipelineInput) {
  const sceneLabels = input.scenes.map((scene) => scene.label).filter(Boolean).join(", ");
  const materialLabels = input.materials.map((material) => `${material.label} (${material.category})`).join(", ");
  const moodboardLabels = input.moodboards.map((moodboard) => moodboard.label).filter(Boolean).join(", ");

  return [
    "Archilya Render Agent Council output. Produce a polished architectural render while preserving the uploaded scene geometry, camera angle, scale, openings, and main masses.",
    sceneLabels ? `Scenes: ${sceneLabels}.` : "",
    materialLabels ? `Material direction: ${materialLabels}.` : "",
    input.lightPreference ? `Lighting preference: ${input.lightPreference}.` : "",
    moodboardLabels ? `Moodboard references: ${moodboardLabels}.` : "",
    "Avoid changing structural proportions. Improve material realism, lighting, depth, and presentation quality.",
  ].filter(Boolean).join("\n");
}

function mapAiStudioJobToPipelineJob(job: AiStudioJobDocument): JobDocument | null {
  if (!job.exists) return null;

  const stage = job.status === "completed" ? 4 : job.status === "running" ? 3 : 1;

  return {
    id: job.id,
    exists: true,
    userId: job.uid,
    status: job.status,
    progressMessage: job.progressMessage || (job.status === "queued" || job.status === "pending" ? "Render işi kuyruğa alındı..." : "Render pipeline çalışıyor..."),
    toolId: "archilyarender",
    toolLabel: "Archilya Render",
    outputType: "image",
    stage,
    totalStages: 4,
    creditCost: RENDER_PIPELINE_CREDIT_COST,
    createdAt: job.createdAt ? String(job.createdAt) : new Date().toISOString(),
    updatedAt: job.updatedAt ? String(job.updatedAt) : new Date().toISOString(),
    startedAt: job.startedAt ? String(job.startedAt) : null,
    completedAt: job.completedAt ? String(job.completedAt) : null,
    result: job.result.imageUrl ? { imageUrl: job.result.imageUrl, mimeType: job.result.mimeType } : null,
    error: job.error,
  };
}

function mapAiStudioJobsToPipelineJob(jobs: AiStudioJobDocument[], expectedCount: number): JobDocument | null {
  const existingJobs = jobs.filter((job) => job.exists);
  if (!existingJobs.length) return null;

  const failedJob = existingJobs.find((job) => job.status === "failed" || job.status === "cancelled");
  if (failedJob) return mapAiStudioJobToPipelineJob(failedJob);

  const completedJobs = existingJobs.filter((job) => job.status === "completed" && job.result.imageUrl);
  const allCompleted = expectedCount > 0 && completedJobs.length === expectedCount;
  const runningJob = existingJobs.find((job) => job.status === "running") ?? existingJobs[0];
  const baseJob = mapAiStudioJobToPipelineJob(runningJob);
  if (!baseJob) return null;

  if (allCompleted) {
    return {
      ...baseJob,
      status: "completed",
      stage: 4,
      progressMessage: "Render pipeline tamamlandı.",
      result: { imageUrl: completedJobs[0]?.result.imageUrl ?? "", mimeType: completedJobs[0]?.result.mimeType ?? "image/png" },
      completedAt: new Date().toISOString(),
    };
  }

  return {
    ...baseJob,
    status: existingJobs.some((job) => job.status === "running" || job.status === "completed") ? "running" : baseJob.status,
    stage: completedJobs.length > 0 ? 3 : baseJob.stage,
    progressMessage: completedJobs.length > 0
      ? `${completedJobs.length}/${expectedCount} render tamamlandı...`
      : baseJob.progressMessage,
  };
}

function getCompletedOutputUrls(jobs: AiStudioJobDocument[]) {
  return jobs
    .filter((job) => job.exists && job.status === "completed" && job.result.imageUrl)
    .map((job) => job.result.imageUrl);
}

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [jobState, setJobState] = useState<JobState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState(false);
  const [approvalStageId, setApprovalStageId] = useState<PipelineStage["id"] | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [outputImageUrl, setOutputImageUrl] = useState<string | null>(null);
  const [outputImageUrls, setOutputImageUrls] = useState<string[]>([]);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [aiStudioJobsById, setAiStudioJobsById] = useState<Record<string, AiStudioJobDocument>>({});
  const { currentUser } = useAuth();
  const queuedAtRef = useRef<number | null>(null);
  const lastProgressAtRef = useRef<number | null>(null);
  const lastProgressSignatureRef = useRef("");
  const timedOutJobIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const draft = readPersistedDraft();
    if (!draft) return;
    startTransition(() => {
      if (draft.jobState) setJobState(draft.jobState);
      if (draft.isRunning || (draft.jobState && draft.activeJobId && !draft.jobState.completedAt && !draft.pipelineError)) {
        setIsRunning(true);
        queuedAtRef.current = Date.now();
        lastProgressAtRef.current = Date.now();
        lastProgressSignatureRef.current = "restored";
      }
      if (draft.awaitingApproval) setAwaitingApproval(draft.awaitingApproval);
      if (draft.approvalStageId) setApprovalStageId(draft.approvalStageId);
      if (draft.activeJobId) setActiveJobId(draft.activeJobId);
      if (draft.activeJobIds?.length) setActiveJobIds(draft.activeJobIds);
      if (draft.outputImageUrl) setOutputImageUrl(draft.outputImageUrl);
      if (draft.outputImageUrls?.length) setOutputImageUrls(draft.outputImageUrls);
      if (draft.pipelineError) setPipelineError(draft.pipelineError);
    });
  }, []);
  const credits = useCredits();
  const t = useTranslations("dashboard.archilyaRender");

  const { job: legacyRenderJob } = useRenderJob(activeJobId);
  const aiStudioJobState = useAiStudioJob(currentUser?.uid ?? null, activeJobId);
  const trackedAiStudioJobs = useMemo(() => activeJobIds.map((jobId) => aiStudioJobsById[jobId]).filter((job): job is AiStudioJobDocument => Boolean(job)), [activeJobIds, aiStudioJobsById]);
  const activeJob = useMemo(
    () => {
      if (activeJobIds.length > 1) {
        return mapAiStudioJobsToPipelineJob(trackedAiStudioJobs, activeJobIds.length);
      }

      return mapAiStudioJobsToPipelineJob(trackedAiStudioJobs, activeJobIds.length)
        ?? mapAiStudioJobToPipelineJob(aiStudioJobState.data)
        ?? (legacyRenderJob?.exists ? legacyRenderJob : null);
    },
    [activeJobIds.length, aiStudioJobState.data, legacyRenderJob, trackedAiStudioJobs],
  );

  useEffect(() => {
    if (!currentUser?.uid || activeJobIds.length === 0) return undefined;

    const db = getFirebaseFirestore();
    const unsubscribes: Unsubscribe[] = activeJobIds.map((jobId) => {
      const jobRef = doc(db, "users", currentUser.uid, AI_STUDIO_JOB_SUBCOLLECTION, jobId);
      return onSnapshot(jobRef, (snapshot) => {
        const nextJob = mapAiStudioJobSnapshot(snapshot, jobId);
        setAiStudioJobsById((current) => ({ ...current, [jobId]: nextJob }));
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [activeJobIds, currentUser?.uid]);

  const prevJobRef = useRef<JobDocument | null>(null);

  useEffect(() => {
    if (!activeJob) return;
    if (timedOutJobIdsRef.current.has(activeJob.id)) return;

    const prevJob = prevJobRef.current;
    prevJobRef.current = activeJob;
    const progressSignature = [activeJob.status, activeJob.stage ?? "", activeJob.progressMessage, activeJob.result?.imageUrl ?? ""].join("|");
    if (progressSignature !== lastProgressSignatureRef.current) {
      lastProgressSignatureRef.current = progressSignature;
      lastProgressAtRef.current = Date.now();
    }

    const currentStage = mapJobToPipelineStage(activeJob);
    if (!currentStage) return;

    const isWaitingForWorker = activeJob.status === "pending" || activeJob.status === "queued";

    setJobState((current) => {
      if (!current) return current;

      const updatedStages = current.stages.map((stage) => {
        if (activeJob.status === "completed") {
          return { ...stage, status: stage.id === 4 ? "DONE" as const : "APPROVED" as const };
        }
        if (stage.id < currentStage) return { ...stage, status: "APPROVED" as const };
        if (stage.id === currentStage) {
          return { ...stage, status: isWaitingForWorker ? "PENDING" as const : "ACTIVE" as const };
        }
        return { ...stage, status: "PENDING" as const };
      });

      const overallProgress = isWaitingForWorker
        ? 0
        : activeJob.totalStages
          ? Math.round((currentStage / activeJob.totalStages) * 100)
          : Math.round((currentStage / 4) * 100);

      const agentRole = getAgentRoleForStage(currentStage);
      const updatedAgents = current.agents.map((agent) => {
        if (activeJob.status === "completed") {
          return {
            ...agent,
            status: "DONE" as const,
            progress: 100,
            currentTask: activeJob.progressMessage || t("pipeline.completed"),
            messages: activeJob.progressMessage && activeJob.progressMessage !== prevJob?.progressMessage
              ? [...agent.messages, {
                  agentRole: agent.role,
                  content: activeJob.progressMessage,
                  timestamp: Date.now(),
                  type: "result" as const,
                }]
              : agent.messages,
          };
        }
        if (agent.role === agentRole) {
          return {
            ...agent,
            status: activeJob.status === "running" ? "WORKING" : agent.status,
            progress: activeJob.status === "running" ? 65 : agent.progress,
            currentTask: activeJob.progressMessage || agent.currentTask,
            messages: activeJob.progressMessage && activeJob.progressMessage !== prevJob?.progressMessage
              ? [...agent.messages, {
                  agentRole: agentRole as AgentRole,
                  content: activeJob.progressMessage,
                  timestamp: Date.now(),
                  type: "action" as const,
                }]
              : agent.messages,
          };
        }
        if (agent.role === "ORCHESTRATOR") {
          return {
            ...agent,
            status: activeJob.status === "running" ? "THINKING" : agent.status,
            messages: activeJob.progressMessage && activeJob.progressMessage !== prevJob?.progressMessage
              ? [...agent.messages, {
                  agentRole: "ORCHESTRATOR" as const,
                  content: activeJob.progressMessage,
                  timestamp: Date.now(),
                  type: "thought" as const,
                }]
              : agent.messages,
          };
        }
        return agent;
      });

      return {
        ...current,
        stages: updatedStages,
        agents: updatedAgents,
        currentStageId: currentStage,
        overallProgress,
        completedAt: activeJob.status === "completed" ? Date.now() : current.completedAt,
      };
    });

    if (activeJob.status === "running" && currentStage < 4) {
      setIsRunning(true);
      setAwaitingApproval(false);
      setApprovalStageId(null);
    }

    if (activeJob.status === "completed") {
      queuedAtRef.current = null;
      lastProgressAtRef.current = null;
      const completedOutputUrls = getCompletedOutputUrls(trackedAiStudioJobs);
      const nextOutputUrls = completedOutputUrls.length ? completedOutputUrls : activeJob.result?.imageUrl ? [activeJob.result.imageUrl] : [];
      if (nextOutputUrls.length) {
        setOutputImageUrls(nextOutputUrls);
        setOutputImageUrl(nextOutputUrls[0] ?? null);
      }

      if (currentStage < 4) {
        setIsRunning(false);
        setAwaitingApproval(true);
        setApprovalStageId(currentStage);
      } else {
        setIsRunning(false);
        setAwaitingApproval(false);
        setApprovalStageId(null);
        setOutputImageUrl(nextOutputUrls[0] ?? activeJob.result?.imageUrl ?? null);
      }
    }

    if (activeJob.status === "failed" || activeJob.status === "cancelled") {
      queuedAtRef.current = null;
      lastProgressAtRef.current = null;
      setIsRunning(false);
      setAwaitingApproval(false);
      setApprovalStageId(null);
      setPipelineError(activeJob.error?.message || t("pipeline.failed"));
    }
  }, [activeJob, t, trackedAiStudioJobs]);

  useEffect(() => {
    if (!isRunning || !activeJobId || activeJob) return undefined;

    if (!queuedAtRef.current) {
      queuedAtRef.current = Date.now();
    }

    const timeoutId = window.setTimeout(() => {
      if (Date.now() - (queuedAtRef.current ?? Date.now()) < JOB_DISCOVERY_TIMEOUT_MS) return;

      const message = t("pipeline.jobNotFoundTimeout");
      timedOutJobIdsRef.current.add(activeJobId);
      setPipelineError(message);
      setIsRunning(false);
      setAwaitingApproval(false);
      setApprovalStageId(null);
      setJobState((current) => current ? markPipelineFailed(current, message) : current);
      toast.error(message);
    }, JOB_DISCOVERY_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeJob, activeJobId, isRunning, t]);

  useEffect(() => {
    if (!isRunning || !activeJob) return undefined;
    if (activeJob.status === "completed" || activeJob.status === "failed" || activeJob.status === "cancelled") return undefined;

    if (!lastProgressAtRef.current) {
      lastProgressAtRef.current = Date.now();
    }

    const timeoutId = window.setTimeout(() => {
      if (Date.now() - (lastProgressAtRef.current ?? Date.now()) < JOB_PROGRESS_TIMEOUT_MS) return;

      const message = t("pipeline.jobProgressTimeout");
      timedOutJobIdsRef.current.add(activeJob.id);
      setPipelineError(message);
      setIsRunning(false);
      setAwaitingApproval(false);
      setApprovalStageId(null);
      setJobState((current) => current ? markPipelineFailed(current, message) : current);
      toast.error(message);
    }, JOB_PROGRESS_TIMEOUT_MS);

    return () => window.clearTimeout(timeoutId);
  }, [activeJob, isRunning, t]);

  useEffect(() => {
    const draft: PersistedPipelineDraft = {
      jobState,
      isRunning,
      awaitingApproval,
      approvalStageId,
      activeJobId,
      activeJobIds,
      outputImageUrl,
      outputImageUrls,
      pipelineError,
    };

    try {
      window.localStorage.setItem(PIPELINE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors.
    }
  }, [approvalStageId, awaitingApproval, jobState, isRunning, activeJobId, activeJobIds, outputImageUrl, outputImageUrls, pipelineError]);

  const startPipeline = useCallback(async (input: PipelineInput) => {
    if (!credits.hasEnough(RENDER_PIPELINE_CREDIT_COST)) {
      toast.error(t("pipeline.insufficientCredits"));
        setPipelineError(t("pipeline.insufficientCreditsShort"));
      return;
    }

    setPipelineError(null);
    setOutputImageUrl(null);
    setOutputImageUrls([]);
    setAiStudioJobsById({});
    setJobState(buildJob());
    setIsRunning(true);
    setAwaitingApproval(false);
    setApprovalStageId(null);
    timedOutJobIdsRef.current.clear();
    queuedAtRef.current = Date.now();
    lastProgressAtRef.current = Date.now();
    lastProgressSignatureRef.current = "queued";

    const renderableScenes = input.scenes.filter((scene) => scene.imageFile || scene.imagePreview || scene.thumbnailUrl);
    if (!renderableScenes.length) {
      const message = t("pipeline.startFailed");
      queuedAtRef.current = null;
      lastProgressAtRef.current = null;
      setPipelineError(message);
      setIsRunning(false);
      toast.error(message);
      return;
    }

    try {
      const results = await Promise.all(renderableScenes.map((scene) => queueAiStudioJob({
          toolId: "enhance",
          imageFile: scene.imageFile,
          imageUrl: scene.imageFile ? null : scene.imagePreview || scene.thumbnailUrl || null,
          extraNote: buildPipelinePrompt({ ...input, scenes: [scene] }),
        })));
      const jobIds = results.map((result) => result.jobId);

      setActiveJobId(jobIds[0] ?? null);
      setActiveJobIds(jobIds);
      setJobState((current) => current ? { ...current, jobId: jobIds.join(",") } : current);
    } catch (error) {
      queuedAtRef.current = null;
      lastProgressAtRef.current = null;
      const message = getPipelineErrorMessage(error, t("pipeline.startFailed"));
      setPipelineError(message);
      setIsRunning(false);
      toast.error(message);
    }
  }, [credits, t]);

  const approveStage = useCallback(() => {
    if (!approvalStageId || !activeJobId) return;

    const approvedStageId = approvalStageId;
    setJobState((current) =>
      current
        ? {
            ...current,
            stages: current.stages.map((stage) =>
              stage.id === approvedStageId
                ? { ...stage, status: approvedStageId === 4 ? "DONE" : "APPROVED" }
                : stage,
            ),
            completedAt: approvedStageId === 4 ? Date.now() : current.completedAt,
            overallProgress: approvedStageId === 4 ? 100 : current.overallProgress,
          }
        : current,
    );
    setAwaitingApproval(false);
    setApprovalStageId(null);

    if (approvedStageId < 4) {
      setIsRunning(true);
    }
  }, [approvalStageId, activeJobId]);

  const requestRevision = useCallback(
    async (feedback: string, stageId?: PipelineStage["id"]) => {
      const targetStageId = stageId ?? approvalStageId ?? 1;
      setJobState((current) =>
        current
          ? {
              ...current,
              currentStageId: targetStageId,
              stages: current.stages.map((stage) =>
                stage.id === targetStageId
                  ? { ...stage, status: "REJECTED" }
                  : stage.id > targetStageId
                    ? { ...stage, status: "PENDING" }
                    : stage,
              ),
              agents: current.agents.map((agent) =>
                agent.role === "REVISION"
                  ? {
                      ...agent,
                      status: "WORKING",
                      progress: 35,
                      currentTask: feedback,
                      messages: [
                        ...agent.messages,
                        {
                          agentRole: "REVISION",
                          content: feedback,
                          timestamp: Date.now(),
                          type: "action",
                        },
                      ],
                    }
                  : agent,
              ),
            }
          : current,
      );
      setIsRunning(true);
      setAwaitingApproval(false);
      setApprovalStageId(null);

      if (!activeJobId) return;

      try {
        const result = await requestRenderRevision({
          jobId: activeJobId,
          stageId: targetStageId,
          feedback,
        });
        timedOutJobIdsRef.current.add(activeJobId);
        setActiveJobId(result.jobId);
        setActiveJobIds([result.jobId]);
        toast.success(t("revisionRequested"));
      } catch (error) {
        const message = error instanceof Error ? error.message : t("revisionFailed");
        toast.error(message);
        setPipelineError(message);
        setIsRunning(false);
        setAwaitingApproval(true);
        setApprovalStageId(targetStageId);
      }
    },
    [approvalStageId, activeJobId, t],
  );

  const resetPipeline = useCallback(() => {
    setJobState(null);
    setIsRunning(false);
    setAwaitingApproval(false);
    setApprovalStageId(null);
    setActiveJobId(null);
    setActiveJobIds([]);
    setOutputImageUrl(null);
    setOutputImageUrls([]);
    setAiStudioJobsById({});
    setPipelineError(null);
    prevJobRef.current = null;
    queuedAtRef.current = null;
    lastProgressAtRef.current = null;
    lastProgressSignatureRef.current = "";
    timedOutJobIdsRef.current.clear();

    try {
      window.localStorage.removeItem(PIPELINE_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const value = useMemo<PipelineContextValue>(
    () => ({
      jobState,
      isRunning,
      awaitingApproval,
      approvalStageId,
      activeJobId,
      activeJobIds,
      startPipeline,
      approveStage,
      requestRevision,
      resetPipeline,
      outputImageUrl,
      outputImageUrls,
      pipelineError,
    }),
    [jobState, isRunning, awaitingApproval, approvalStageId, activeJobId, activeJobIds, startPipeline, approveStage, requestRevision, resetPipeline, outputImageUrl, outputImageUrls, pipelineError],
  );

  return <PipelineContext.Provider value={value}>{children}</PipelineContext.Provider>;
}

export function usePipelineContext() {
  const context = useContext(PipelineContext);
  if (!context) {
    throw new Error("usePipelineContext must be used within a PipelineProvider.");
  }
  return context;
}
