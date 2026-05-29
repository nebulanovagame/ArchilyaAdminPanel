// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  t: vi.fn((key: string) => key),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  buildDefaultAiFileName: vi.fn(() => "ai-output"),
  ensureFileExtension: vi.fn((fileName: string, ext: string) => `${fileName}.${ext}`),
  getMimeAndExtFromImageSource: vi.fn(() => ({ mimeType: "image/png", ext: "png" })),
  imageSourceToFile: vi.fn(),
  isDataUrl: vi.fn(),
  uploadProjectFiles: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next-intl", () => ({ useTranslations: () => mocks.t }));
vi.mock("react-hot-toast", () => ({ default: { success: mocks.toast.success, error: mocks.toast.error } }));
vi.mock("../utils", () => ({
  buildDefaultAiFileName: mocks.buildDefaultAiFileName,
  ensureFileExtension: mocks.ensureFileExtension,
  getMimeAndExtFromImageSource: mocks.getMimeAndExtFromImageSource,
  imageSourceToFile: mocks.imageSourceToFile,
  isDataUrl: mocks.isDataUrl,
}));
vi.mock("@/lib/projects/service", () => ({ uploadProjectFiles: mocks.uploadProjectFiles }));

import type { ProjectRecord } from "@/lib/projects/types";
import type { ResultImage, ResultMeta } from "../types";
import { useAiStudioFileOps } from "./use-ai-studio-file-ops";

function createResultImage(overrides: Partial<ResultImage> = {}): ResultImage {
  return {
    src: "https://cdn.example.com/result.png",
    mimeType: "image/png",
    ...overrides,
  };
}

function createResultMeta(overrides: Partial<ResultMeta> = {}): ResultMeta {
  return {
    id: "history-1",
    toolId: "img2img",
    toolLabel: "Image to Image",
    outputType: "image",
    style: "modern",
    sceneEditMode: "scene-compose",
    referenceCount: 1,
    extraNote: "",
    generationVariant: "default",
    createdAt: "2026-05-27T00:00:00.000Z",
    ...overrides,
  };
}

function createProject(overrides: Partial<ProjectRecord> = {}): ProjectRecord {
  return {
    id: "project-1",
    uid: "user-1",
    memberUids: ["user-1"],
    name: "Project Alpha",
    status: "Aktif",
    fileCount: { pdf: 0, dwg: 0, img: 0 },
    totalSize: 0,
    files: [],
    deletedFiles: [],
    isDeleted: false,
    deletedAt: null,
    ...overrides,
  };
}

function createDeps(overrides: Partial<Parameters<typeof useAiStudioFileOps>[3]> = {}) {
  return {
    currentUser: { uid: "user-1", email: "user@example.com" },
    ownerName: "Owner Name",
    imageSourceMessages: {
      missingSource: "Missing source",
      downloadFailed: "Download failed",
    },
    myProjects: [createProject()],
    refreshProjects: vi.fn().mockResolvedValue(undefined),
    updatePoolStorage: vi.fn().mockResolvedValue(undefined),
    setSaving: vi.fn(),
    setSharing: vi.fn(),
    ...overrides,
  };
}

function setupAnchorSpy() {
  const realCreateElement = document.createElement.bind(document);
  const anchors: HTMLAnchorElement[] = [];

  vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
    const element = realCreateElement(tagName);
    if (tagName === "a") {
      Object.defineProperty(element, "click", {
        configurable: true,
        value: vi.fn(),
      });
      anchors.push(element as HTMLAnchorElement);
    }
    return element;
  });

  return { anchors };
}

describe("useAiStudioFileOps", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useFakeTimers();

    mocks.t.mockImplementation((key: string) => key);
    mocks.buildDefaultAiFileName.mockReturnValue("ai-output");
    mocks.ensureFileExtension.mockImplementation((fileName: string, ext: string) => `${fileName}.${ext}`);
    mocks.getMimeAndExtFromImageSource.mockReturnValue({ mimeType: "image/png", ext: "png" });
    mocks.isDataUrl.mockReturnValue(false);
    mocks.imageSourceToFile.mockResolvedValue(new File(["image-bytes"], "ai-output.png", { type: "image/png" }));
    mocks.uploadProjectFiles.mockResolvedValue(undefined);

    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("downloads data URLs directly", async () => {
    mocks.isDataUrl.mockReturnValue(true);
    const { anchors } = setupAnchorSpy();

    const { result } = renderHook(() =>
      useAiStudioFileOps(createResultImage({ src: "data:image/png;base64,abc" }), createResultMeta(), "Visualizer", createDeps()),
    );

    await act(async () => {
      await result.current.handleDownloadCurrentResult();
    });

    expect(mocks.imageSourceToFile).not.toHaveBeenCalled();
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.href).toBe("data:image/png;base64,abc");
    expect(anchors[0]?.download).toBe("ai-output.png");
    expect(anchors[0]?.click).toHaveBeenCalledTimes(1);
    expect(mocks.toast.success).toHaveBeenCalledWith("dashboard.aiStudio.downloaded");
  });

  it("downloads remote images through blob URLs and revokes the object URL", async () => {
    const file = new File(["remote-image"], "remote.png", { type: "image/png" });
    mocks.imageSourceToFile.mockResolvedValue(file);
    const { anchors } = setupAnchorSpy();

    const { result } = renderHook(() =>
      useAiStudioFileOps(createResultImage(), createResultMeta(), "Visualizer", createDeps()),
    );

    await act(async () => {
      await result.current.handleDownloadCurrentResult();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mocks.imageSourceToFile).toHaveBeenCalledWith(
      "https://cdn.example.com/result.png",
      "ai-output.png",
      "image/png",
      expect.objectContaining({ missingSource: "Missing source", downloadFailed: "Download failed" }),
    );
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.href).toBe("blob:mock-url");
    expect(anchors[0]?.download).toBe("ai-output.png");
    expect(anchors[0]?.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
    expect(mocks.toast.success).toHaveBeenCalledWith("dashboard.aiStudio.downloaded");
  });

  it("shows an error toast when download fails", async () => {
    mocks.imageSourceToFile.mockRejectedValue(new Error("network failed"));
    setupAnchorSpy();

    const { result } = renderHook(() =>
      useAiStudioFileOps(createResultImage(), createResultMeta(), "Visualizer", createDeps()),
    );

    await act(async () => {
      await result.current.handleDownloadCurrentResult();
    });

    expect(mocks.toast.error).toHaveBeenCalledWith("network failed");
    expect(mocks.toast.success).not.toHaveBeenCalled();
  });

  it("shares natively when navigator share supports files", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn(() => true);
    const shareFile = new File(["share-image"], "share.png", { type: "image/png" });
    mocks.imageSourceToFile.mockResolvedValue(shareFile);
    vi.stubGlobal("navigator", { share, canShare });

    const deps = createDeps();
    const { result } = renderHook(() =>
      useAiStudioFileOps(createResultImage(), createResultMeta(), "Visualizer", deps),
    );

    await act(async () => {
      await result.current.handleNativeShare();
    });

    expect(deps.setSharing).toHaveBeenNthCalledWith(1, true);
    expect(canShare).toHaveBeenCalledWith({ files: [shareFile] });
    expect(share).toHaveBeenCalledWith({
      title: "Archilya AI · Visualizer",
      files: [shareFile],
    });
    expect(mocks.toast.success).toHaveBeenCalledWith("dashboard.aiStudio.shareOpened");
    expect(deps.setSharing).toHaveBeenLastCalledWith(false);
  });

  it("falls back to download when native share is unavailable", async () => {
    mocks.isDataUrl.mockReturnValue(true);
    const { anchors } = setupAnchorSpy();
    vi.stubGlobal("navigator", { canShare: vi.fn() });

    const deps = createDeps();
    const { result } = renderHook(() =>
      useAiStudioFileOps(createResultImage({ src: "data:image/png;base64,fallback" }), createResultMeta(), "Visualizer", deps),
    );

    await act(async () => {
      await result.current.handleNativeShare();
    });

    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.click).toHaveBeenCalledTimes(1);
    expect(mocks.toast.success).toHaveBeenCalledWith("dashboard.aiStudio.downloaded");
    expect(deps.setSharing).not.toHaveBeenCalled();
  });

  it("does not show an error toast when native share is aborted", async () => {
    const share = vi.fn().mockRejectedValue({ name: "AbortError" });
    const canShare = vi.fn(() => true);
    vi.stubGlobal("navigator", { share, canShare });

    const deps = createDeps();
    const { result } = renderHook(() =>
      useAiStudioFileOps(createResultImage(), createResultMeta(), "Visualizer", deps),
    );

    await act(async () => {
      await result.current.handleNativeShare();
    });

    expect(mocks.toast.error).not.toHaveBeenCalled();
    expect(mocks.toast.success).not.toHaveBeenCalledWith("dashboard.aiStudio.shareOpened");
    expect(deps.setSharing).toHaveBeenNthCalledWith(1, true);
    expect(deps.setSharing).toHaveBeenLastCalledWith(false);
  });

  it("saves the result to the first project and refreshes project state", async () => {
    const outputFile = new File(["project-image"], "project.png", { type: "image/png" });
    mocks.imageSourceToFile.mockResolvedValue(outputFile);
    const deps = createDeps({ myProjects: [createProject({ name: "Villa Project" })] });

    const { result } = renderHook(() =>
      useAiStudioFileOps(createResultImage(), createResultMeta(), "Visualizer", deps),
    );

    await act(async () => {
      await result.current.handleSaveResultToProject();
    });

    expect(deps.setSaving).toHaveBeenNthCalledWith(1, true);
    expect(mocks.uploadProjectFiles).toHaveBeenCalledWith(
      expect.objectContaining({ id: "project-1", name: "Villa Project" }),
      [outputFile],
      "user-1",
      "Owner Name",
    );
    expect(deps.refreshProjects).toHaveBeenCalledTimes(1);
    expect(deps.updatePoolStorage).toHaveBeenCalledWith(outputFile.size);
    expect(mocks.toast.success).toHaveBeenCalledWith("dashboard.aiStudio.savedToProject");
    expect(deps.setSaving).toHaveBeenLastCalledWith(false);
  });

  it("shows an error when there is no result to save", async () => {
    const deps = createDeps();

    const { result } = renderHook(() =>
      useAiStudioFileOps(null, createResultMeta(), "Visualizer", deps),
    );

    await act(async () => {
      await result.current.handleSaveResultToProject();
    });

    expect(mocks.toast.error).toHaveBeenCalledWith("dashboard.aiStudio.saveMissing");
    expect(deps.setSaving).not.toHaveBeenCalled();
    expect(mocks.uploadProjectFiles).not.toHaveBeenCalled();
  });

  it("shows an error when there are no projects available", async () => {
    const deps = createDeps({ myProjects: [] });

    const { result } = renderHook(() =>
      useAiStudioFileOps(createResultImage(), createResultMeta(), "Visualizer", deps),
    );

    await act(async () => {
      await result.current.handleSaveResultToProject();
    });

    expect(mocks.toast.error).toHaveBeenCalledWith("dashboard.aiStudio.createProjectFirst");
    expect(deps.setSaving).not.toHaveBeenCalled();
    expect(mocks.uploadProjectFiles).not.toHaveBeenCalled();
  });
});
