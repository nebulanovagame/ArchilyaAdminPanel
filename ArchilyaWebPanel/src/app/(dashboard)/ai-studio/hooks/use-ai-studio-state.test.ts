// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  t: vi.fn((key: string) => key),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(() => "toast-id"),
  },
  authState: {
    currentUser: { uid: "user-1", email: "user@example.com", displayName: "Test User" },
    loading: false,
  },
  creditsState: { credits: 100, hasEnough: vi.fn(() => true) },
  projectsState: { projects: [], refresh: vi.fn().mockResolvedValue(undefined) },
  workspaceState: { activeWorkspace: { id: "workspace-1" }, updatePoolStorage: vi.fn().mockResolvedValue(undefined) },
  notificationState: { notify: vi.fn().mockResolvedValue(undefined), requestPermission: vi.fn().mockResolvedValue("granted") },
  jobState: { data: { exists: false, status: "pending" }, loading: false, error: null },
  useAiStudioJobCalls: [] as Array<[string | null, string | null]>,
  getAiPromptHistorySecure: vi.fn().mockResolvedValue({ history: {} }),
  saveAiPromptHistorySecure: vi.fn().mockResolvedValue({ history: {} }),
  queueAiStudioJob: vi.fn().mockResolvedValue({ jobId: "job-1" }),
  createActivityLogEntry: vi.fn().mockResolvedValue(undefined),
  getFirebaseFirestore: vi.fn(),
  logAiGenerationSuccess: vi.fn(),
  saveAiJobFeedback: vi.fn().mockResolvedValue(undefined),
  uploadProjectFiles: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next-intl", () => ({ useTranslations: () => mocks.t }));
vi.mock("react-hot-toast", () => ({ default: mocks.toast }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => mocks.authState }));
vi.mock("@/hooks/use-credits", () => ({ useCredits: () => mocks.creditsState }));
vi.mock("@/hooks/use-projects", () => ({ useProjects: () => mocks.projectsState }));
vi.mock("@/hooks/use-workspace", () => ({ useWorkspace: () => mocks.workspaceState }));
vi.mock("@/hooks/use-desktop-notification", () => ({ useDesktopNotification: () => mocks.notificationState }));
vi.mock("@/hooks/use-ai-studio-job", () => ({
  useAiStudioJob: (uid: string | null, jobId: string | null) => {
    mocks.useAiStudioJobCalls.push([uid, jobId]);
    return mocks.jobState;
  },
}));
vi.mock("@/services/entitlement-service", () => ({
  getAiPromptHistorySecure: mocks.getAiPromptHistorySecure,
  saveAiPromptHistorySecure: mocks.saveAiPromptHistorySecure,
}));
vi.mock("@/services/nano-banana-service", () => ({ queueAiStudioJob: mocks.queueAiStudioJob }));
vi.mock("@/lib/activity/service", () => ({ createActivityLogEntry: mocks.createActivityLogEntry }));
vi.mock("@/lib/firebase/client", () => ({ getFirebaseFirestore: mocks.getFirebaseFirestore }));
vi.mock("@/lib/analytics/events", () => ({ logAiGenerationSuccess: mocks.logAiGenerationSuccess }));
vi.mock("@/lib/ai-studio/service", () => ({ saveAiJobFeedback: mocks.saveAiJobFeedback }));
vi.mock("@/lib/projects/service", () => ({ uploadProjectFiles: mocks.uploadProjectFiles }));

import { TOOLS } from "../constants";
import { useAiStudioState } from "./use-ai-studio-state";

const storageKey = "archilya:ai-studio:active-job:v1:user-1";

const storedJob = {
  jobId: "stored-job-1",
  toolId: "img2img",
  style: "modern",
  sceneEditMode: "scene-compose",
  extraNote: "keep the facade",
  outputType: "image" as const,
  generationVariant: "default",
  sourceImageUri: "https://cdn.example.com/source.png",
};

function createJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "",
    exists: false,
    uid: "user-1",
    email: "user@example.com",
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
    ...overrides,
  };
}

function seedStoredJob() {
  localStorage.setItem(storageKey, JSON.stringify(storedJob));
}

async function flushTimers() {
  await act(async () => {
    await vi.runOnlyPendingTimersAsync();
  });
}

describe("useAiStudioState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    mocks.useAiStudioJobCalls.length = 0;
    mocks.jobState.data = createJob() as typeof mocks.jobState.data;
    mocks.jobState.loading = false;
    mocks.jobState.error = null;

    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("clearRef clears stale job state and localStorage", async () => {
    seedStoredJob();
    mocks.jobState.data = createJob({
      id: storedJob.jobId,
      exists: true,
      status: "completed",
      toolId: storedJob.toolId,
      outputType: "image",
      style: storedJob.style,
      sceneEditMode: storedJob.sceneEditMode,
      extraNote: storedJob.extraNote,
      generationVariant: storedJob.generationVariant,
      sourceImageUri: storedJob.sourceImageUri,
      result: { text: "", imageUrl: "https://cdn.example.com/result.png", mimeType: "image/png" },
    }) as typeof mocks.jobState.data;

    const { result } = renderHook(() => useAiStudioState());

    await flushTimers();
    await flushTimers();
    await flushTimers();
    expect(result.current.state.resultImage).toEqual({ src: "https://cdn.example.com/result.png", mimeType: "image/png" });

    act(() => {
      result.current.actions.clearRef();
    });

    expect(result.current.state.activeJobId).toBeNull();
    expect(result.current.state.activeJobDraft).toBeNull();
    expect(result.current.state.resultImage).toBeNull();
    expect(result.current.state.resultMeta).toBeNull();
    expect(result.current.state.resultText).toBeNull();
    expect(result.current.state.jobFailureMessage).toBeNull();
    expect(result.current.state.revisionSteps).toEqual([]);
    expect(result.current.state.revisionCursor).toBe(-1);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("mount restore restores stored job when user has not modified input", async () => {
    seedStoredJob();

    const { result } = renderHook(() => useAiStudioState());

    await flushTimers();

    expect(result.current.state.activeJobId).toBe(storedJob.jobId);
    expect(result.current.state.selectedTool?.id).toBe(storedJob.toolId);
    expect(result.current.state.selectedFileUrl).toBe(storedJob.sourceImageUri);
    expect(result.current.state.refImagePreview).toBe(storedJob.sourceImageUri);
    expect(result.current.state.activeJobDraft).toEqual(expect.objectContaining({
      id: storedJob.jobId,
      toolId: storedJob.toolId,
      outputType: storedJob.outputType,
      style: storedJob.style,
      sceneEditMode: storedJob.sceneEditMode,
      extraNote: storedJob.extraNote,
      generationVariant: storedJob.generationVariant,
      sourceImageUri: storedJob.sourceImageUri,
    }));
  });

  it("mount restore skips stored job when user modified input before flush", async () => {
    seedStoredJob();

    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.actions.handlePrimaryFileSelection(new File(["new"], "new.png", { type: "image/png" }));
    });
    await flushTimers();

    expect(result.current.state.activeJobId).toBeNull();
    expect(result.current.state.activeJobDraft).toBeNull();
    expect(result.current.state.refImageFile?.name).toBe("new.png");
    expect(result.current.state.refImagePreview).toMatch(/^blob:/);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });

  it("handlePrimaryFileSelection marks input as user-modified", () => {
    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.actions.handlePrimaryFileSelection(new File(["primary"], "primary.png", { type: "image/png" }));
    });

    expect(result.current.state.refImageFile?.name).toBe("primary.png");
    expect(result.current.state.refImagePreview).toMatch(/^blob:/);
    expect(result.current.state.activeJobId).toBeNull();
  });

  it("selectTool clears result and revision state", async () => {
    seedStoredJob();
    mocks.jobState.data = createJob({
      id: storedJob.jobId,
      exists: true,
      status: "completed",
      toolId: storedJob.toolId,
      outputType: "image",
      style: storedJob.style,
      sceneEditMode: storedJob.sceneEditMode,
      extraNote: storedJob.extraNote,
      generationVariant: storedJob.generationVariant,
      sourceImageUri: storedJob.sourceImageUri,
      result: { text: "", imageUrl: "https://cdn.example.com/result.png", mimeType: "image/png" },
    }) as typeof mocks.jobState.data;

    const { result } = renderHook(() => useAiStudioState());

    await flushTimers();
    await flushTimers();
    await flushTimers();
    expect(result.current.state.resultImage).toEqual({ src: "https://cdn.example.com/result.png", mimeType: "image/png" });

    expect(result.current.state.selectedTool?.id).toBe(storedJob.toolId);
    expect(result.current.state.resultMeta).not.toBeNull();
    expect(result.current.state.revisionSteps).toHaveLength(1);
    expect(result.current.state.revisionCursor).toBe(0);

    act(() => {
      result.current.actions.selectTool(TOOLS[0]);
    });

    expect(result.current.state.selectedTool?.id).toBe(TOOLS[0].id);
    expect(result.current.state.resultImage).toBeNull();
    expect(result.current.state.resultMeta).toBeNull();
    expect(result.current.state.resultText).toBeNull();
    expect(result.current.state.jobFailureMessage).toBeNull();
    expect(result.current.state.revisionSteps).toEqual([]);
    expect(result.current.state.revisionCursor).toBe(-1);
  });
});
