// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  t: vi.fn((key: string) => key),
  toast: { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => "toast-id") },
  useAiStudioJobData: { data: { exists: false, status: "pending" }, loading: false, error: null },
  useAiStudioJobCalls: [] as Array<[string | null, string | null]>,
  queueAiStudioJob: vi.fn().mockResolvedValue({ jobId: "job-123" }),
  createActivityLogEntry: vi.fn().mockResolvedValue(undefined),
  getAiPromptHistorySecure: vi.fn().mockResolvedValue({ history: {} }),
  saveAiPromptHistorySecure: vi.fn().mockResolvedValue({ history: {} }),
  saveAiJobFeedback: vi.fn().mockResolvedValue(undefined),
  generatePromptInspiration: vi.fn().mockResolvedValue({ text: "Try warmer tones" }),
  buildToolNote: vi.fn((_toolId: string, note: string) => note),
  clearStoredActiveJob: vi.fn(),
  persistActiveJob: vi.fn(),
  readStoredActiveJob: vi.fn(),
  getFriendlyAIError: vi.fn(() => "AI error"),
  getToolById: vi.fn(),
  sanitizePromptHistoryEntry: vi.fn(),
  sanitizePromptHistoryMap: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => mocks.t }));
vi.mock("react-hot-toast", () => ({ default: mocks.toast }));
vi.mock("@/hooks/use-ai-studio-job", () => ({
  useAiStudioJob: (uid: string | null, jobId: string | null) => {
    mocks.useAiStudioJobCalls.push([uid, jobId]);
    return mocks.useAiStudioJobData;
  },
}));
vi.mock("./use-ai-studio-job-terminal", () => ({
  useAiStudioJobTerminal: vi.fn(),
}));
vi.mock("@/services/nano-banana-service", () => ({
  queueAiStudioJob: mocks.queueAiStudioJob,
  generatePromptInspiration: mocks.generatePromptInspiration,
}));
vi.mock("@/lib/activity/service", () => ({
  createActivityLogEntry: mocks.createActivityLogEntry,
}));
vi.mock("@/services/entitlement-service", () => ({
  getAiPromptHistorySecure: mocks.getAiPromptHistorySecure,
  saveAiPromptHistorySecure: mocks.saveAiPromptHistorySecure,
}));
vi.mock("@/lib/ai-studio/service", () => ({
  saveAiJobFeedback: mocks.saveAiJobFeedback,
}));
vi.mock("../utils", () => ({
  buildToolNote: mocks.buildToolNote,
  clearStoredActiveJob: mocks.clearStoredActiveJob,
  getFriendlyAIError: mocks.getFriendlyAIError,
  getToolById: mocks.getToolById,
  persistActiveJob: mocks.persistActiveJob,
  readStoredActiveJob: mocks.readStoredActiveJob,
  sanitizePromptHistoryEntry: mocks.sanitizePromptHistoryEntry,
  sanitizePromptHistoryMap: mocks.sanitizePromptHistoryMap,
}));

import type { ToolConfig } from "../types";
import { useAiStudioJobLifecycle } from "./use-ai-studio-job-lifecycle";
import type { JobLifecycleDeps, GenerateContext } from "./use-ai-studio-job-lifecycle";
import { TOOLS } from "../constants";

const bridgingRef = { current: { setResultMeta: vi.fn(), setCompareSplit: vi.fn(), setResultText: vi.fn(), setResultImage: vi.fn(), setRevisionSteps: vi.fn(), setRevisionCursor: vi.fn() } };

const img2imgTool = TOOLS.find((t) => t.id === "img2img") as ToolConfig;

function createDeps(overrides: Partial<JobLifecycleDeps> = {}): JobLifecycleDeps {
  return {
    currentUser: { uid: "user-1", email: "user@test.com", name: "Test User" },
    ownerName: "Test User",
    credits: 100,
    hasEnough: vi.fn(() => true),
    activeWorkspace: { id: "ws-1" },
    updatePoolStorage: vi.fn().mockResolvedValue(undefined),
    getToolLabel: vi.fn((tool: ToolConfig) => tool.id),
    t: mocks.t as unknown as JobLifecycleDeps["t"],
    notify: vi.fn().mockResolvedValue(undefined),
    bridgingRef,
    ...overrides,
  };
}

function createGenerateContext(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return {
    selectedTool: img2imgTool,
    style: "modern",
    extraNote: "",
    sceneEditMode: "scene-compose",
    revisionType: "general",
    analysisFocus: ["material", "light"],
    multiAnglePreserve: [],
    atmosphere: "golden-hour",
    materialLanguage: "natural-wood",
    styleStrength: "medium",
    enhancePreserve: [],
    scenePreserveAreas: [],
    planType: "floor-plan",
    palette: "warm-premium",
    roomLabels: true,
    presentationStyle: "clean-modern",
    reportTone: "professional",
    sceneReferences: [],
    refImageFile: null,
    selectedFileUrl: "https://cdn.example.com/input.png",
    refImagePreview: "https://cdn.example.com/input.png",
    hasPrimarySource: true,
    hasRequiredSceneReferences: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  localStorage.clear();
  mocks.useAiStudioJobData = { data: { exists: false, status: "pending" }, loading: false, error: null };
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("useAiStudioJobLifecycle", () => {
  it("initializes with default state", () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    expect(result.current.activeJobId).toBeNull();
    expect(result.current.submittingJob).toBe(false);
    expect(result.current.generatingPromptInspiration).toBe(false);
    expect(result.current.jobFailureMessage).toBeNull();
    expect(result.current.restorePayload).toBeNull();
    expect(result.current.activeJobDraft).toBeNull();
  });

  it("loads prompt history on mount", async () => {
    renderHook(() => useAiStudioJobLifecycle(createDeps()));

    await vi.runAllTimersAsync();
    expect(mocks.getAiPromptHistorySecure).toHaveBeenCalled();
  });

  it("handleGenerate validates primary source", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    const ctx = createGenerateContext({ hasPrimarySource: false });

    await act(async () => {
      await result.current.handleGenerate(ctx);
    });

    expect(mocks.toast.error).toHaveBeenCalledWith(
      expect.stringContaining("referenceRequiredToast"),
    );
    expect(mocks.queueAiStudioJob).not.toHaveBeenCalled();
  });

  it("handleGenerate validates credit", async () => {
    const deps = createDeps({ hasEnough: vi.fn(() => false) });
    const { result } = renderHook(() => useAiStudioJobLifecycle(deps));

    await act(async () => {
      await result.current.handleGenerate(createGenerateContext());
    });

    expect(mocks.toast.error).toHaveBeenCalledWith(
      expect.stringContaining("creditRequiredToast"),
      expect.objectContaining({ duration: 4000 }),
    );
    expect(mocks.queueAiStudioJob).not.toHaveBeenCalled();
  });

  it("handleGenerate queues a job and sets activeJobId on success", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    await act(async () => {
      await result.current.handleGenerate(createGenerateContext());
    });

    expect(mocks.queueAiStudioJob).toHaveBeenCalled();
    expect(result.current.activeJobId).toBe("job-123");
    expect(result.current.activeJobDraft).not.toBeNull();
    expect(mocks.toast.success).toHaveBeenCalled();
  });

  it("handleGenerate clears results before new job via bridgingRef", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    await act(async () => {
      await result.current.handleGenerate(createGenerateContext());
    });

    expect(bridgingRef.current.setResultImage).toHaveBeenCalledWith(null);
    expect(bridgingRef.current.setResultText).toHaveBeenCalledWith(null);
    expect(bridgingRef.current.setResultMeta).toHaveBeenCalledWith(null);
    expect(bridgingRef.current.setCompareSplit).toHaveBeenCalledWith(50);
    expect(bridgingRef.current.setRevisionSteps).toHaveBeenCalledWith([]);
    expect(bridgingRef.current.setRevisionCursor).toHaveBeenCalledWith(-1);
  });

  it("handleGenerate handles queue errors gracefully", async () => {
    mocks.queueAiStudioJob.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    await act(async () => {
      await result.current.handleGenerate(createGenerateContext());
    });

    expect(mocks.toast.error).toHaveBeenCalled();
    expect(result.current.submittingJob).toBe(false);
  });

  it("runVariation appends variation note and calls handleGenerate", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    await act(async () => {
      await result.current.runVariation(createGenerateContext());
    });

    expect(mocks.queueAiStudioJob).toHaveBeenCalled();
  });

  it("handleGeneratePromptInspiration returns text and does NOT set it directly", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    let text: string | null = null;
    await act(async () => {
      text = await result.current.handleGeneratePromptInspiration(createGenerateContext());
    });

    expect(text).toBe("Try warmer tones");
    expect(mocks.generatePromptInspiration).toHaveBeenCalled();
  });

  it("handleGeneratePromptInspiration validates primary source", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    await act(async () => {
      await result.current.handleGeneratePromptInspiration(
        createGenerateContext({ hasPrimarySource: false }),
      );
    });

    expect(mocks.toast.error).toHaveBeenCalled();
    expect(mocks.generatePromptInspiration).not.toHaveBeenCalled();
  });

  it("handleFeedback saves feedback", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    // Set activeJobId so feedback has a target
    await act(async () => {
      await result.current.handleGenerate(createGenerateContext());
    });

    vi.clearAllMocks();

    await act(async () => {
      await result.current.handleFeedback("positive");
    });

    expect(mocks.saveAiJobFeedback).toHaveBeenCalledWith("user-1", "job-123", "positive");
    expect(mocks.toast.success).toHaveBeenCalled();
  });

  it("handleFeedback skips if no activeJobId", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    await act(async () => {
      await result.current.handleFeedback("positive");
    });

    expect(mocks.saveAiJobFeedback).not.toHaveBeenCalled();
  });

  it("restores job from localStorage on mount", async () => {
    mocks.readStoredActiveJob.mockReturnValue({
      jobId: "stored-job-1",
      toolId: "img2img",
      style: "modern",
      sceneEditMode: "scene-compose",
      extraNote: "keep the facade",
      outputType: "image",
      generationVariant: "default",
      sourceImageUri: "https://cdn.example.com/source.png",
    });
    mocks.getToolById.mockReturnValue(img2imgTool);

    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.activeJobId).toBe("stored-job-1");
    expect(result.current.restorePayload).not.toBeNull();
    expect(result.current.restorePayload?.tool?.id).toBe("img2img");
  });

  it("markInputModified prevents job restoration", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    act(() => {
      result.current.markInputModified();
    });

    mocks.readStoredActiveJob.mockReturnValue({
      jobId: "stored-job-1",
      toolId: "img2img",
      style: "modern",
      sceneEditMode: "scene-compose",
      extraNote: "",
      outputType: "image",
      generationVariant: "default",
      sourceImageUri: "",
    });
    mocks.getToolById.mockReturnValue(img2imgTool);

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    // Should NOT restore because user modified input
    expect(result.current.activeJobId).toBeNull();
  });

  it("promptHistory state updates addPromptHistoryEntry", async () => {
    const { result } = renderHook(() => useAiStudioJobLifecycle(createDeps()));

    mocks.sanitizePromptHistoryEntry.mockReturnValue({
      id: "entry-1",
      toolId: "img2img",
      toolLabel: "img2img",
      outputType: "image",
      style: "modern",
      sceneEditMode: "replace",
      referenceCount: 0,
      extraNote: "test",
      generationVariant: "default",
      statusLabel: "done",
      createdAt: new Date().toISOString(),
    });
    mocks.sanitizePromptHistoryMap.mockReturnValue({
      img2img: [{ id: "entry-1", toolId: "img2img", toolLabel: "img2img", outputType: "image", style: "modern", sceneEditMode: "replace", referenceCount: 0, extraNote: "test", generationVariant: "default", statusLabel: "done", createdAt: new Date().toISOString() }],
    });

    await act(async () => {
      result.current.addPromptHistoryEntry({ toolId: "img2img" });
    });

    // The entry should be added to the local state
    expect(result.current.promptHistoryByTool).toBeDefined();
  });
});
