// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  t: vi.fn((key: string) => key),
  toast: { success: vi.fn(), error: vi.fn() },
  isAiStudioJobTerminal: vi.fn(),
  logAiGenerationSuccess: vi.fn(),
  toIsoString: vi.fn(() => "2026-05-28T00:00:00.000Z"),
}));

vi.mock("next-intl", () => ({ useTranslations: () => mocks.t }));
vi.mock("react-hot-toast", () => ({ default: { success: mocks.toast.success, error: mocks.toast.error } }));
vi.mock("@/lib/ai-studio/job-contract", () => ({
  isAiStudioJobTerminal: mocks.isAiStudioJobTerminal,
}));
vi.mock("@/lib/analytics/events", () => ({
  logAiGenerationSuccess: mocks.logAiGenerationSuccess,
}));
vi.mock("../utils", () => ({
  toIsoString: mocks.toIsoString,
}));

import { useAiStudioJobTerminal } from "./use-ai-studio-job-terminal";
import type { ToolConfig } from "../types";

type TerminalJobParam = Parameters<typeof useAiStudioJobTerminal>[1];

const tool: ToolConfig = {
  id: "img2img",
  icon: vi.fn() as unknown as ToolConfig["icon"],
  category: "render",
  credit: 2,
  hasStyle: true,
  outputType: "image",
  accentColor: "text-primary",
  accentBg: "bg-primary/10",
  accentBorder: "border-primary/20",
};

const textTool: ToolConfig = { ...tool, id: "analysis", outputType: "text" };

function createBridgingRef() {
  return {
    current: {
      setResultMeta: vi.fn(),
      setCompareSplit: vi.fn(),
      setResultText: vi.fn(),
      setResultImage: vi.fn(),
      setRevisionSteps: vi.fn(),
      setRevisionCursor: vi.fn(),
    },
  };
}

function createActiveJob(overrides: Partial<TerminalJobParam> = {}): TerminalJobParam {
  return {
    status: "pending",
    exists: true,
    toolId: "img2img",
    style: "modern",
    sceneEditMode: "replace",
    extraNote: "test",
    outputType: "image" as const,
    sourceImageUri: "",
    generationVariant: "default",
    referenceCount: 1,
    error: null,
    result: { imageUrl: "", mimeType: "", text: "" },
    completedAt: null,
    updatedAt: null,
    createdAt: null,
    ...overrides,
  };
}

const setJobFailureMessage = vi.fn();
const addPromptHistoryEntry = vi.fn();
const getToolLabel = vi.fn((t: ToolConfig) => t.id);
const getSuccessMessage = vi.fn(() => "Completed!");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAiStudioJobTerminal.mockImplementation(
    (job: { status: string }) =>
      job.status === "completed" || job.status === "failed" || job.status === "cancelled",
  );
});

describe("useAiStudioJobTerminal", () => {
  it("cleans up refs when activeJobId becomes null", () => {
    const bridgingRef = createBridgingRef();
    const { rerender } = renderHook(
      ({ jobId }) =>
        useAiStudioJobTerminal(
          jobId,
          createActiveJob(),
          tool,
          null,
          null,
          getToolLabel,
          getSuccessMessage,
          addPromptHistoryEntry,
          bridgingRef,
          setJobFailureMessage,
          mocks.t,
          vi.fn(),
        ),
      { initialProps: { jobId: "job-1" as string | null } },
    );

    rerender({ jobId: null });

    // After cleanup with null jobId, no terminal handling should fire
    expect(bridgingRef.current.setResultImage).not.toHaveBeenCalled();
  });

  it("handles completed image job: sets result image and meta", () => {
    const bridgingRef = createBridgingRef();
    const activeJob = createActiveJob({
      status: "completed",
      result: { imageUrl: "https://cdn.example.com/output.png", mimeType: "image/png", text: "" },
    });

    renderHook(() =>
      useAiStudioJobTerminal(
        "job-1",
        activeJob,
        tool,
        null,
        null,
        getToolLabel,
        getSuccessMessage,
        addPromptHistoryEntry,
        bridgingRef,
        setJobFailureMessage,
        mocks.t,
        vi.fn(),
      ),
    );

    expect(bridgingRef.current.setResultMeta).toHaveBeenCalledWith(
      expect.objectContaining({ id: "job-1", toolId: "img2img" }),
    );
    expect(bridgingRef.current.setCompareSplit).toHaveBeenCalledWith(50);
    expect(bridgingRef.current.setResultImage).toHaveBeenCalledWith({
      src: "https://cdn.example.com/output.png",
      mimeType: "image/png",
    });
    expect(bridgingRef.current.setRevisionSteps).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ src: "https://cdn.example.com/output.png" }),
      ]),
    );
    expect(bridgingRef.current.setRevisionCursor).toHaveBeenCalledWith(0);
    expect(bridgingRef.current.setResultText).toHaveBeenCalledWith(null);
    expect(setJobFailureMessage).toHaveBeenCalledWith(null);
    expect(mocks.toast.success).toHaveBeenCalled();
    expect(mocks.logAiGenerationSuccess).toHaveBeenCalledWith("img2img");
    expect(addPromptHistoryEntry).toHaveBeenCalled();
  });

  it("handles completed text job: sets result text", () => {
    const bridgingRef = createBridgingRef();
    const activeJob = createActiveJob({
      status: "completed",
      outputType: "text",
      result: { imageUrl: "", mimeType: "", text: "Analysis result text" },
    });

    renderHook(() =>
      useAiStudioJobTerminal(
        "job-1",
        activeJob,
        textTool,
        null,
        null,
        getToolLabel,
        getSuccessMessage,
        addPromptHistoryEntry,
        bridgingRef,
        setJobFailureMessage,
        mocks.t,
        vi.fn(),
      ),
    );

    expect(bridgingRef.current.setResultText).toHaveBeenCalledWith("Analysis result text");
    expect(bridgingRef.current.setResultImage).toHaveBeenCalledWith(null);
    expect(bridgingRef.current.setRevisionSteps).toHaveBeenCalledWith([]);
    expect(bridgingRef.current.setRevisionCursor).toHaveBeenCalledWith(-1);
    expect(mocks.toast.success).toHaveBeenCalled();
  });

  it("handles failed job: sets failure message and clears results", () => {
    const bridgingRef = createBridgingRef();
    const activeJob = createActiveJob({
      status: "failed",
      error: { message: "AI service unavailable" },
    });

    renderHook(() =>
      useAiStudioJobTerminal(
        "job-1",
        activeJob,
        tool,
        null,
        null,
        getToolLabel,
        getSuccessMessage,
        addPromptHistoryEntry,
        bridgingRef,
        setJobFailureMessage,
        mocks.t,
        vi.fn(),
      ),
    );

    expect(setJobFailureMessage).toHaveBeenCalledWith("AI service unavailable");
    expect(bridgingRef.current.setResultImage).toHaveBeenCalledWith(null);
    expect(bridgingRef.current.setResultText).toHaveBeenCalledWith(null);
    expect(bridgingRef.current.setRevisionSteps).toHaveBeenCalledWith([]);
    expect(bridgingRef.current.setRevisionCursor).toHaveBeenCalledWith(-1);
    expect(mocks.toast.error).toHaveBeenCalled();
  });

  it("handles cancelled job: clears results without error", () => {
    const bridgingRef = createBridgingRef();
    const activeJob = createActiveJob({ status: "cancelled" });

    renderHook(() =>
      useAiStudioJobTerminal(
        "job-1",
        activeJob,
        tool,
        null,
        null,
        getToolLabel,
        getSuccessMessage,
        addPromptHistoryEntry,
        bridgingRef,
        setJobFailureMessage,
        mocks.t,
        vi.fn(),
      ),
    );

    expect(setJobFailureMessage).toHaveBeenCalled();
    expect(bridgingRef.current.setResultImage).toHaveBeenCalledWith(null);
    expect(bridgingRef.current.setResultText).toHaveBeenCalledWith(null);
    expect(mocks.toast.error).toHaveBeenCalled();
  });

  it("does NOT handle non-terminal jobs", () => {
    const bridgingRef = createBridgingRef();
    mocks.isAiStudioJobTerminal.mockReturnValue(false);
    const activeJob = createActiveJob({ status: "running" });

    renderHook(() =>
      useAiStudioJobTerminal(
        "job-1",
        activeJob,
        tool,
        null,
        null,
        getToolLabel,
        getSuccessMessage,
        addPromptHistoryEntry,
        bridgingRef,
        setJobFailureMessage,
        mocks.t,
        vi.fn(),
      ),
    );

    expect(bridgingRef.current.setResultImage).not.toHaveBeenCalled();
    expect(setJobFailureMessage).not.toHaveBeenCalled();
  });

  it("prevents duplicate handling for the same jobId+status combination", () => {
    const bridgingRef = createBridgingRef();
    const activeJob = createActiveJob({
      status: "completed",
      result: { imageUrl: "https://cdn.example.com/output.png", mimeType: "image/png", text: "" },
    });

    const { rerender } = renderHook(
      () =>
        useAiStudioJobTerminal(
          "job-1",
          activeJob,
          tool,
          null,
          null,
          getToolLabel,
          getSuccessMessage,
          addPromptHistoryEntry,
          bridgingRef,
          setJobFailureMessage,
          mocks.t,
          vi.fn(),
        ),
    );

    // Reset call counts
    vi.clearAllMocks();

    // Re-render with same job — should NOT handle again
    rerender();

    expect(bridgingRef.current.setResultImage).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("sends desktop notification when page is hidden and job transitions to terminal", () => {
    const bridgingRef = createBridgingRef();
    const notify = vi.fn();

    // Simulate hidden page
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });

    // First render with non-terminal job to set observedJobStatusRef
    const runningJob = createActiveJob({ status: "running" });
    const { rerender } = renderHook(
      ({ job }) =>
        useAiStudioJobTerminal(
          "job-1",
          job,
          tool,
          null,
          null,
          getToolLabel,
          getSuccessMessage,
          addPromptHistoryEntry,
          bridgingRef,
          setJobFailureMessage,
          mocks.t,
          notify,
        ),
      { initialProps: { job: runningJob } },
    );

    // Now re-render with completed job — shouldNotify = true because
    // previousObservedStatus was "running" and visibility is "hidden"
    const completedJob = createActiveJob({
      status: "completed",
      result: { imageUrl: "https://cdn.example.com/output.png", mimeType: "image/png", text: "" },
    });
    rerender({ job: completedJob });

    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "img2img",
        tag: "ai-studio-job-job-1",
      }),
    );

    // Restore visibility
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("uses selectedTool as fallback when activeJobTool is null", () => {
    const bridgingRef = createBridgingRef();
    const activeJob = createActiveJob({
      status: "completed",
      result: { imageUrl: "https://cdn.example.com/fallback.png", mimeType: "image/png", text: "" },
    });

    renderHook(() =>
      useAiStudioJobTerminal(
        "job-1",
        activeJob,
        null, // activeJobTool is null
        tool, // selectedTool as fallback
        null,
        getToolLabel,
        getSuccessMessage,
        addPromptHistoryEntry,
        bridgingRef,
        setJobFailureMessage,
        mocks.t,
        vi.fn(),
      ),
    );

    expect(bridgingRef.current.setResultMeta).toHaveBeenCalledWith(
      expect.objectContaining({ toolId: "img2img" }),
    );
    expect(bridgingRef.current.setResultImage).toHaveBeenCalledWith(
      expect.objectContaining({ src: "https://cdn.example.com/fallback.png" }),
    );
  });
});
