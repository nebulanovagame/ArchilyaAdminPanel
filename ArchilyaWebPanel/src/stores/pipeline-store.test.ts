// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PipelineProvider, usePipelineContext, type PipelineInput } from "@/stores/pipeline-store";
import type { JobDocument } from "@/lib/ai-studio/render-pipeline";
import type { AiStudioJobDocument } from "@/lib/ai-studio/job-contract";

const mocks = vi.hoisted(() => ({
  creditsState: {
    hasEnough: vi.fn(() => true),
    credits: 100,
    loading: false,
    plan: "free" as string,
    status: "inactive" as string,
    planId: "" as string,
    startAt: null as string | null,
    endAt: null as string | null,
    autoRenew: false,
    cancelledAt: null as string | null,
    pendingPlanId: "" as string,
    billingCreditBalanceKurus: 0,
    INITIAL_CREDITS: 150,
    deductCredits: vi.fn().mockResolvedValue(true),
    refundCredits: vi.fn().mockResolvedValue(true),
  },
  renderJobState: {
    job: null as JobDocument | null,
    isLoading: false,
    error: null as Error | null,
    reset: vi.fn(),
    isTerminal: false,
    isCompleted: false,
    isFailed: false,
    isCancelled: false,
  },
  aiStudioJobState: {
    data: {
      id: "",
      exists: false,
      uid: "",
      email: "",
      status: "pending",
      progressMessage: "",
      toolId: "",
      toolLabel: "",
      outputType: "image",
      style: "",
      sceneEditMode: "",
      referenceCount: 0,
      extraNote: "",
      generationVariant: "default",
      sourceImageName: "",
      sourceImageMimeType: "",
      sourceImageUri: "",
      result: { text: "", imageUrl: "", mimeType: "" },
      error: null,
      createdAt: null,
      updatedAt: null,
      startedAt: null,
      completedAt: null,
      feedback: null,
    },
    loading: false,
    error: null as Error | null,
  },
  aiStudioJobsById: {} as Record<string, AiStudioJobDocument>,
  queueAiStudioJob: vi.fn(),
  requestRenderRevision: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  t: vi.fn((key: string) => key),
}));

vi.mock("@/hooks/use-credits", () => ({
  useCredits: () => mocks.creditsState,
}));

vi.mock("@/hooks/use-render-job", () => ({
  useRenderJob: () => mocks.renderJobState,
}));

vi.mock("@/hooks/use-ai-studio-job", () => ({
  useAiStudioJob: () => mocks.aiStudioJobState,
}));

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((...parts: string[]) => {
    const id = parts[parts.length - 1] ?? "";
    return { id, path: parts.join("/") };
  }),
  onSnapshot: vi.fn((ref: { id: string }, onNext: (snapshot: { id: string; exists: () => boolean; data: () => Record<string, unknown> }) => void) => {
    const job = mocks.aiStudioJobsById[ref.id];
    onNext({
      id: ref.id,
      exists: () => Boolean(job?.exists),
      data: () => job as unknown as Record<string, unknown>,
    });
    return vi.fn();
  }),
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseFirestore: vi.fn(() => ({})),
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => ({ currentUser: { uid: "user-1", email: "user@example.com" } }),
}));

vi.mock("@/services/nano-banana-service", () => ({
  queueAiStudioJob: mocks.queueAiStudioJob,
}));

vi.mock("@/lib/ai-studio/render-pipeline", () => ({
  requestRenderRevision: mocks.requestRenderRevision,
}));

vi.mock("react-hot-toast", () => ({
  default: { error: mocks.toastError, success: mocks.toastSuccess },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => mocks.t,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(PipelineProvider, {}, children);
}

const baseInput: PipelineInput = {
  scenes: [
    {
      id: "scene-1",
      label: "Salon",
      direction: "north",
      type: "interior",
      imageFile: null,
      imagePreview: "data:image/png;base64,scene",
      thumbnailUrl: null,
      hasFurnishing: true,
      frameQuality: 90,
      order: 0,
      createdAt: 1,
    },
  ],
  materials: [
    {
      id: "material-1",
      label: "Mermer",
      category: "floor",
      imageFile: null,
      imagePreview: "data:image/png;base64,material",
      order: 0,
      createdAt: 1,
    },
  ],
  moodboards: [],
  lightPreference: "sunny",
};

function buildJobDocument(overrides: Partial<JobDocument> = {}): JobDocument {
  return {
    id: "job-1",
    exists: true,
    userId: "user-1",
    status: "pending",
    progressMessage: "",
    toolId: "render",
    toolLabel: "Render",
    outputType: "image",
    creditCost: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
    ...overrides,
  } as JobDocument;
}

function setAiStudioJob(overrides: Partial<typeof mocks.aiStudioJobState.data> = {}) {
  mocks.aiStudioJobState.data = {
    ...mocks.aiStudioJobState.data,
    id: "job-1",
    exists: true,
    uid: "user-1",
    ...overrides,
  };
}

function buildAiStudioJob(id: string, overrides: Partial<AiStudioJobDocument> = {}): AiStudioJobDocument {
  return {
    id,
    exists: true,
    uid: "user-1",
    email: "user@example.com",
    status: "pending",
    progressMessage: "",
    toolId: "enhance",
    toolLabel: "Enhance",
    outputType: "image",
    style: "",
    sceneEditMode: "",
    referenceCount: 0,
    extraNote: "",
    generationVariant: "default",
    sourceImageName: "",
    sourceImageMimeType: "image/png",
    sourceImageUri: "",
    result: { text: "", imageUrl: "", mimeType: "" },
    error: null,
    createdAt: null,
    updatedAt: null,
    startedAt: null,
    completedAt: null,
    feedback: null,
    ...overrides,
  };
}

describe("pipeline-store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1000);
    mocks.creditsState.hasEnough.mockReturnValue(true);
    mocks.renderJobState.job = null;
    mocks.renderJobState.isLoading = false;
    mocks.renderJobState.isCompleted = false;
    mocks.renderJobState.isFailed = false;
    mocks.renderJobState.isTerminal = false;
    mocks.aiStudioJobsById = {};
    mocks.aiStudioJobState.data = {
      ...mocks.aiStudioJobState.data,
      id: "",
      exists: false,
      status: "pending",
      progressMessage: "",
      result: { text: "", imageUrl: "", mimeType: "" },
      error: null,
    };
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts pipeline successfully", async () => {
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const { result } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.jobState).not.toBeNull();
    expect(result.current.pipelineError).toBeNull();
    expect(mocks.queueAiStudioJob).toHaveBeenCalledOnce();
    expect(mocks.queueAiStudioJob).toHaveBeenCalledWith(
      expect.objectContaining({
        toolId: "enhance",
        imageUrl: "data:image/png;base64,scene",
        extraNote: expect.stringContaining("Archilya Render Agent Council"),
      }),
    );
  });

  it("queues one render job for each renderable scene", async () => {
    mocks.queueAiStudioJob
      .mockResolvedValueOnce({ jobId: "job-1" })
      .mockResolvedValueOnce({ jobId: "job-2" });
    const { result } = renderHook(() => usePipelineContext(), { wrapper });
    const multiSceneInput: PipelineInput = {
      ...baseInput,
      scenes: [
        ...baseInput.scenes,
        {
          ...baseInput.scenes[0],
          id: "scene-2",
          label: "Mutfak",
          imagePreview: "data:image/png;base64,scene2",
          order: 1,
        },
      ],
    };

    await act(async () => {
      await result.current.startPipeline(multiSceneInput);
    });

    expect(mocks.queueAiStudioJob).toHaveBeenCalledTimes(2);
    expect(mocks.queueAiStudioJob).toHaveBeenNthCalledWith(1, expect.objectContaining({ imageUrl: "data:image/png;base64,scene" }));
    expect(mocks.queueAiStudioJob).toHaveBeenNthCalledWith(2, expect.objectContaining({ imageUrl: "data:image/png;base64,scene2" }));
    expect(result.current.activeJobId).toBe("job-1");
    expect(result.current.activeJobIds).toEqual(["job-1", "job-2"]);
    expect(result.current.jobState?.jobId).toBe("job-1,job-2");
  });

  it("does not complete a multi-scene pipeline until every scene job completes", async () => {
    mocks.queueAiStudioJob
      .mockResolvedValueOnce({ jobId: "job-1" })
      .mockResolvedValueOnce({ jobId: "job-2" });
    mocks.aiStudioJobsById = {
      "job-1": buildAiStudioJob("job-1", {
        status: "completed",
        result: { text: "", imageUrl: "https://example.com/scene-1.png", mimeType: "image/png" },
      }),
      "job-2": buildAiStudioJob("job-2", { status: "running", progressMessage: "Second scene rendering" }),
    };
    const { result } = renderHook(() => usePipelineContext(), { wrapper });
    const multiSceneInput: PipelineInput = {
      ...baseInput,
      scenes: [
        ...baseInput.scenes,
        { ...baseInput.scenes[0], id: "scene-2", label: "Mutfak", imagePreview: "data:image/png;base64,scene2", order: 1 },
      ],
    };

    await act(async () => {
      await result.current.startPipeline(multiSceneInput);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.jobState?.completedAt).toBeUndefined();
    expect(result.current.outputImageUrls).toEqual([]);
  });

  it("collects all scene output urls and marks all agents terminal when multi-scene jobs complete", async () => {
    mocks.queueAiStudioJob
      .mockResolvedValueOnce({ jobId: "job-1" })
      .mockResolvedValueOnce({ jobId: "job-2" });
    mocks.aiStudioJobsById = {
      "job-1": buildAiStudioJob("job-1", {
        status: "completed",
        result: { text: "", imageUrl: "https://example.com/scene-1.png", mimeType: "image/png" },
      }),
      "job-2": buildAiStudioJob("job-2", {
        status: "completed",
        result: { text: "", imageUrl: "https://example.com/scene-2.png", mimeType: "image/png" },
      }),
    };
    const { result } = renderHook(() => usePipelineContext(), { wrapper });
    const multiSceneInput: PipelineInput = {
      ...baseInput,
      scenes: [
        ...baseInput.scenes,
        { ...baseInput.scenes[0], id: "scene-2", label: "Mutfak", imagePreview: "data:image/png;base64,scene2", order: 1 },
      ],
    };

    await act(async () => {
      await result.current.startPipeline(multiSceneInput);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.jobState?.completedAt).toBe(1000);
    expect(result.current.outputImageUrls).toEqual(["https://example.com/scene-1.png", "https://example.com/scene-2.png"]);
    expect(result.current.jobState?.stages.map((stage) => stage.status)).toEqual(["APPROVED", "APPROVED", "APPROVED", "DONE"]);
    expect(result.current.jobState?.agents.every((agent) => agent.status === "DONE")).toBe(true);
  });

  it("fails to start when credits are insufficient", async () => {
    mocks.creditsState.hasEnough.mockReturnValue(false);
    const { result } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.pipelineError).toBe("pipeline.insufficientCreditsShort");
    expect(mocks.toastError).toHaveBeenCalledWith("pipeline.insufficientCredits");
    expect(mocks.queueAiStudioJob).not.toHaveBeenCalled();
  });

  it("fails to start when startRenderPipeline throws", async () => {
    mocks.queueAiStudioJob.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.pipelineError).toBe("Network error");
    expect(mocks.toastError).toHaveBeenCalledWith("Network error");
  });

  it("transitions to awaiting approval when job completes at intermediate stage", async () => {
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const { result, rerender } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    expect(result.current.isRunning).toBe(true);

    mocks.renderJobState.job = buildJobDocument({
      status: "completed",
      stage: 1,
      totalStages: 4,
      progressMessage: "Stage 1 completed",
      result: { imageUrl: "https://example.com/stage1.png" },
    });

    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.awaitingApproval).toBe(true);
    });
    expect(result.current.approvalStageId).toBe(1);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.outputImageUrl).toBe("https://example.com/stage1.png");
  });

  it("marks pipeline done when final stage completes", async () => {
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const { result, rerender } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    setAiStudioJob({
      status: "completed",
      progressMessage: "All stages completed",
      result: { text: "", imageUrl: "https://example.com/final.png", mimeType: "image/png" },
    });

    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.awaitingApproval).toBe(false);
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.approvalStageId).toBeNull();
    expect(result.current.outputImageUrl).toBe("https://example.com/final.png");
  });

  it("handles job failure", async () => {
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const { result, rerender } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    setAiStudioJob({
      status: "failed",
      progressMessage: "Something went wrong",
      error: { code: "ERR_001", message: "Render failed" },
    });

    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.pipelineError).toBe("Render failed");
    });
    expect(result.current.isRunning).toBe(false);
    expect(result.current.awaitingApproval).toBe(false);
  });

  it("stops when queued job status cannot be loaded", async () => {
    vi.useFakeTimers();
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const dateSpy = vi.spyOn(Date, "now");
    dateSpy.mockReturnValue(1_000);
    const { result } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    dateSpy.mockReturnValue(91_000);
    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(result.current.pipelineError).toBe("pipeline.jobNotFoundTimeout");
    expect(result.current.isRunning).toBe(false);
    expect(result.current.awaitingApproval).toBe(false);
    expect(result.current.jobState?.stages[0].status).toBe("REJECTED");
    expect(mocks.toastError).toHaveBeenCalledWith("pipeline.jobNotFoundTimeout");
  });

  it("does not restart a locally timed-out job when a late snapshot arrives", async () => {
    vi.useFakeTimers();
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const dateSpy = vi.spyOn(Date, "now");
    dateSpy.mockReturnValue(1_000);
    const { result, rerender } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    dateSpy.mockReturnValue(91_000);
    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(result.current.pipelineError).toBe("pipeline.jobNotFoundTimeout");
    expect(result.current.isRunning).toBe(false);

    setAiStudioJob({
      status: "running",
      progressMessage: "Late worker update",
    });

    act(() => {
      rerender();
    });

    expect(result.current.pipelineError).toBe("pipeline.jobNotFoundTimeout");
    expect(result.current.isRunning).toBe(false);
  });

  it("resumes timeout tracking for persisted in-flight jobs", async () => {
    vi.useFakeTimers();
    const dateSpy = vi.spyOn(Date, "now");
    dateSpy.mockReturnValue(1_000);
    localStorage.setItem("archilya-render-pipeline-draft", JSON.stringify({
      jobState: {
        jobId: "job-1",
        sessionId: "session-1",
        stages: [
          { id: 1, name: "Scene Analysis", description: "Reading the scene, scale, and goals", status: "PENDING" },
          { id: 2, name: "Material Matching", description: "Surface and reference material decisions", status: "PENDING" },
          { id: 3, name: "Render Pass", description: "AI render production pipeline", status: "PENDING" },
          { id: 4, name: "Quality Gate", description: "QC and final approval check", status: "PENDING" },
        ],
        agents: [],
        currentStageId: 1,
        overallProgress: 0,
        startedAt: 1_000,
      },
      isRunning: true,
      awaitingApproval: false,
      approvalStageId: null,
      activeJobId: "job-1",
      activeJobIds: ["job-1"],
      outputImageUrl: null,
      outputImageUrls: [],
      pipelineError: null,
    }));

    const { result } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isRunning).toBe(true);

    dateSpy.mockReturnValue(91_000);
    act(() => {
      vi.advanceTimersByTime(90_000);
    });

    expect(result.current.pipelineError).toBe("pipeline.jobNotFoundTimeout");
    expect(result.current.isRunning).toBe(false);
  });

  it("stops when running job does not progress", async () => {
    vi.useFakeTimers();
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const dateSpy = vi.spyOn(Date, "now");
    dateSpy.mockReturnValue(1_000);
    const { result, rerender } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    mocks.renderJobState.job = buildJobDocument({
      status: "running",
      stage: 1,
      totalStages: 4,
      progressMessage: "Render pipeline çalışıyor...",
    });

    act(() => {
      rerender();
    });

    expect(result.current.jobState?.overallProgress).toBe(25);

    dateSpy.mockReturnValue(601_000);
    act(() => {
      vi.advanceTimersByTime(600_000);
    });

    expect(result.current.pipelineError).toBe("pipeline.jobProgressTimeout");
    expect(result.current.isRunning).toBe(false);
    expect(result.current.jobState?.stages[0].status).toBe("REJECTED");
    expect(mocks.toastError).toHaveBeenCalledWith("pipeline.jobProgressTimeout");
  });

  it("approves an intermediate stage", async () => {
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const { result, rerender } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    mocks.renderJobState.job = buildJobDocument({
      status: "completed",
      stage: 1,
      totalStages: 4,
    });
    mocks.renderJobState.isCompleted = true;

    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.awaitingApproval).toBe(true);
    });

    act(() => {
      result.current.approveStage();
    });

    expect(result.current.awaitingApproval).toBe(false);
    expect(result.current.jobState?.stages[0].status).toBe("APPROVED");
    expect(result.current.isRunning).toBe(true);
  });

  it("requests revision for a stage", async () => {
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const { result, rerender } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    mocks.renderJobState.job = buildJobDocument({
      status: "completed",
      stage: 2,
      totalStages: 4,
    });
    mocks.renderJobState.isCompleted = true;

    act(() => {
      rerender();
    });

    await waitFor(() => {
      expect(result.current.awaitingApproval).toBe(true);
    });

    mocks.requestRenderRevision.mockResolvedValue({ jobId: "revision-job-1", status: "pending", parentJobId: "job-1", revisionStageId: 2 });

    await act(async () => {
      await result.current.requestRevision("Change material", 2);
    });

    expect(result.current.awaitingApproval).toBe(false);
    expect(result.current.isRunning).toBe(true);
    expect(result.current.jobState?.stages[1].status).toBe("REJECTED");
    const revisionAgent = result.current.jobState?.agents.find((a) => a.role === "REVISION");
    expect(revisionAgent?.status).toBe("WORKING");
    expect(revisionAgent?.currentTask).toBe("Change material");
    expect(mocks.requestRenderRevision).toHaveBeenCalledWith({ jobId: "job-1", stageId: 2, feedback: "Change material" });
    expect(result.current.activeJobId).toBe("revision-job-1");
  });

  it("resets pipeline state and clears localStorage", async () => {
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const { result } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    act(() => {
      result.current.resetPipeline();
    });

    expect(result.current.jobState).toBeNull();
    expect(result.current.isRunning).toBe(false);
    expect(result.current.awaitingApproval).toBe(false);
    expect(result.current.approvalStageId).toBeNull();
    expect(result.current.outputImageUrl).toBeNull();
    expect(result.current.outputImageUrls).toEqual([]);
    expect(result.current.pipelineError).toBeNull();
    const draftAfterReset = localStorage.getItem("archilya-render-pipeline-draft");
    expect(draftAfterReset).not.toBeNull();
    expect(JSON.parse(draftAfterReset!).jobState).toBeNull();
  });

  it("persists state to localStorage", async () => {
    mocks.queueAiStudioJob.mockResolvedValue({ jobId: "job-1" });
    const { result } = renderHook(() => usePipelineContext(), { wrapper });

    await act(async () => {
      await result.current.startPipeline(baseInput);
    });

    const draft = localStorage.getItem("archilya-render-pipeline-draft");
    expect(draft).not.toBeNull();
    const parsed = JSON.parse(draft!);
    expect(parsed.activeJobId).toBe("job-1");
    expect(parsed.activeJobIds).toEqual(["job-1"]);
    expect(parsed.jobState).not.toBeNull();
  });

  it("throws when used outside provider", () => {
    expect(() => renderHook(() => usePipelineContext())).toThrow(
      "usePipelineContext must be used within a PipelineProvider.",
    );
  });
});
