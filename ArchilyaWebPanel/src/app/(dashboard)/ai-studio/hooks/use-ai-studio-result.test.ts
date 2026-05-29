// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const mockHandleDownloadCurrentResult = vi.fn();
const mockHandleNativeShare = vi.fn();
const mockHandleSaveResultToProject = vi.fn();

vi.mock("./use-ai-studio-file-ops", () => ({
  useAiStudioFileOps: () => ({
    handleDownloadCurrentResult: mockHandleDownloadCurrentResult,
    handleNativeShare: mockHandleNativeShare,
    handleSaveResultToProject: mockHandleSaveResultToProject,
  }),
}));

import type { ResultImage, ResultMeta, ResultRevisionStep } from "../types";
import { useAiStudioResult } from "./use-ai-studio-result";
import type { ResultDeps, UseAiStudioResultReturn } from "./use-ai-studio-result";

const baseMeta: ResultMeta = {
  id: "meta-1",
  toolId: "img2img",
  toolLabel: "Image to Image",
  outputType: "image",
  style: "modern",
  sceneEditMode: "replace",
  referenceCount: 1,
  extraNote: "Warm lighting",
  generationVariant: "default",
  createdAt: "2026-05-27T10:00:00.000Z",
};

const nextMeta: ResultMeta = {
  ...baseMeta,
  id: "meta-2",
  extraNote: "Cool lighting",
  createdAt: "2026-05-27T11:00:00.000Z",
};

const baseImage: ResultImage = { src: "https://example.com/result-1.png", mimeType: "image/png" };
const nextImage: ResultImage = { src: "https://example.com/result-2.png", mimeType: "image/png" };

const revisionSteps: ResultRevisionStep[] = [
  { src: "https://example.com/revision-1.png", mimeType: "image/png", meta: baseMeta },
  { src: "https://example.com/revision-2.png", mimeType: "image/png", meta: nextMeta },
  { src: "https://example.com/revision-3.png", mimeType: "image/png", meta: null },
];

const createDeps = (): ResultDeps => ({
  currentUser: null,
  ownerName: "test",
  imageSourceMessages: { missingSource: "missing", downloadFailed: "failed" },
  myProjects: [],
  refreshProjects: vi.fn(),
  updatePoolStorage: vi.fn().mockResolvedValue(undefined),
});

describe("useAiStudioResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default values", () => {
    const { result } = renderHook(() => useAiStudioResult(createDeps()));

    expectInitialState(result.current);
    expect(result.current.handleDownloadCurrentResult).toBe(mockHandleDownloadCurrentResult);
    expect(result.current.handleNativeShare).toBe(mockHandleNativeShare);
    expect(result.current.handleSaveResultToProject).toBe(mockHandleSaveResultToProject);
  });

  it("setResultAndMeta sets a new result and resets revision tracking", () => {
    const { result } = renderHook(() => useAiStudioResult(createDeps()));

    act(() => {
      result.current.setCompareSplit(33);
      result.current.setResultAndMeta(baseImage, "Generated text", baseMeta, "Render");
    });

    expect(result.current.resultImage).toEqual(baseImage);
    expect(result.current.resultText).toBe("Generated text");
    expect(result.current.resultMeta).toEqual(baseMeta);
    expect(result.current.compareSplit).toBe(50);
    expect(result.current.revisionSteps).toEqual([
      { src: baseImage.src, mimeType: baseImage.mimeType, meta: baseMeta },
    ]);
    expect(result.current.revisionCursor).toBe(0);
    expect(result.current.canUndoRevision).toBe(false);
    expect(result.current.canRedoRevision).toBe(false);
    expect(result.current.hasHiddenResult).toBe(false);
  });

  it("archives the current result when setResultAndMeta replaces it", () => {
    const { result } = renderHook(() => useAiStudioResult(createDeps()));

    act(() => {
      result.current.setResultAndMeta(baseImage, "First result", baseMeta, "Render");
      result.current.setCompareSplit(72);
      result.current.setRevisionSteps(revisionSteps);
      result.current.setRevisionCursor(1);
    });

    act(() => {
      result.current.setResultAndMeta(nextImage, "Second result", nextMeta, "Enhance");
    });

    expect(result.current.resultImage).toEqual(nextImage);
    expect(result.current.resultText).toBe("Second result");
    expect(result.current.resultMeta).toEqual(nextMeta);
    expect(result.current.revisionSteps).toEqual([
      { src: nextImage.src, mimeType: nextImage.mimeType, meta: nextMeta },
    ]);

    act(() => {
      result.current.restoreLastResult();
    });

    expect(result.current.resultImage).toEqual(baseImage);
    expect(result.current.resultText).toBe("First result");
    expect(result.current.resultMeta).toEqual(baseMeta);
    expect(result.current.compareSplit).toBe(72);
    expect(result.current.revisionSteps).toEqual(revisionSteps);
    expect(result.current.revisionCursor).toBe(1);
    expect(result.current.hasHiddenResult).toBe(false);
  });

  it("hideResult preserves data and restoreLastResult brings it back", () => {
    const { result } = renderHook(() => useAiStudioResult(createDeps()));

    act(() => {
      result.current.setResultAndMeta(baseImage, "Visible result", baseMeta, "Render");
      result.current.setCompareSplit(64);
      result.current.setRevisionSteps(revisionSteps);
      result.current.setRevisionCursor(2);
    });

    // hideResult in a separate act() so it sees updated closure values
    act(() => {
      result.current.hideResult();
    });

    expect(result.current.resultImage).toBeNull();
    expect(result.current.resultText).toBeNull();
    expect(result.current.hasHiddenResult).toBe(true);

    act(() => {
      result.current.restoreLastResult();
    });

    expect(result.current.resultImage).toEqual(baseImage);
    expect(result.current.resultText).toBe("Visible result");
    expect(result.current.resultMeta).toEqual(baseMeta);
    expect(result.current.compareSplit).toBe(64);
    expect(result.current.revisionSteps).toEqual(revisionSteps);
    expect(result.current.revisionCursor).toBe(2);
    expect(result.current.hasHiddenResult).toBe(false);
  });

  it("restoreLastResult is a no-op when nothing is hidden", () => {
    const { result } = renderHook(() => useAiStudioResult(createDeps()));

    act(() => {
      result.current.restoreLastResult();
    });

    expectInitialState(result.current);
  });

  it("supports revision navigation and derived undo redo state", () => {
    const { result } = renderHook(() => useAiStudioResult(createDeps()));

    act(() => {
      result.current.setResultAndMeta(baseImage, "Revision result", baseMeta, "Render");
      result.current.setRevisionSteps(revisionSteps);
      result.current.setRevisionCursor(1);
      result.current.setCompareSplit(91);
    });

    expect(result.current.canUndoRevision).toBe(true);
    expect(result.current.canRedoRevision).toBe(true);

    act(() => {
      result.current.applyRevisionStep(2);
    });

    expect(result.current.resultImage).toEqual({ src: revisionSteps[2].src, mimeType: revisionSteps[2].mimeType });
    expect(result.current.resultMeta).toBeNull();
    expect(result.current.revisionCursor).toBe(2);
    expect(result.current.compareSplit).toBe(50);
    expect(result.current.canUndoRevision).toBe(true);
    expect(result.current.canRedoRevision).toBe(false);

    act(() => {
      result.current.handleUndo();
    });

    expect(result.current.resultImage).toEqual({ src: revisionSteps[1].src, mimeType: revisionSteps[1].mimeType });
    expect(result.current.resultMeta).toEqual(nextMeta);
    expect(result.current.revisionCursor).toBe(1);
    expect(result.current.canUndoRevision).toBe(true);
    expect(result.current.canRedoRevision).toBe(true);

    act(() => {
      result.current.handleRedo();
    });

    expect(result.current.resultImage).toEqual({ src: revisionSteps[2].src, mimeType: revisionSteps[2].mimeType });
    expect(result.current.revisionCursor).toBe(2);
    expect(result.current.canRedoRevision).toBe(false);
  });

  it("ignores invalid revision navigation requests", () => {
    const { result } = renderHook(() => useAiStudioResult(createDeps()));

    act(() => {
      result.current.setResultAndMeta(baseImage, "Revision result", baseMeta, "Render");
      result.current.setRevisionSteps(revisionSteps);
      result.current.setRevisionCursor(0);
      result.current.applyRevisionStep(99);
      result.current.handleUndo();
    });

    expect(result.current.resultImage).toEqual(baseImage);
    expect(result.current.resultMeta).toEqual(baseMeta);
    expect(result.current.revisionCursor).toBe(0);
    expect(result.current.canUndoRevision).toBe(false);
    expect(result.current.canRedoRevision).toBe(true);
  });

  it("supports the direct setters for externally managed state", () => {
    const { result } = renderHook(() => useAiStudioResult(createDeps()));

    act(() => {
      result.current.setResultImage(nextImage);
      result.current.setResultText("Manual text");
      result.current.setResultMeta(nextMeta);
      result.current.setCompareSplit(41);
      result.current.setRevisionSteps(revisionSteps);
      result.current.setRevisionCursor(1);
      result.current.setSaving(true);
      result.current.setSharing(true);
      result.current.setResultToolLabel("Enhance");
    });

    expect(result.current.resultImage).toEqual(nextImage);
    expect(result.current.resultText).toBe("Manual text");
    expect(result.current.resultMeta).toEqual(nextMeta);
    expect(result.current.compareSplit).toBe(41);
    expect(result.current.revisionSteps).toEqual(revisionSteps);
    expect(result.current.revisionCursor).toBe(1);
    expect(result.current.saving).toBe(true);
    expect(result.current.sharing).toBe(true);
  });

  it("useResultAsPrimaryScene returns the visible image source", () => {
    const { result } = renderHook(() => useAiStudioResult(createDeps()));

    expect(result.current.useResultAsPrimaryScene()).toBeUndefined();

    act(() => {
      result.current.setResultImage(baseImage);
    });

    expect(result.current.useResultAsPrimaryScene()).toBe(baseImage.src);
  });
});

function expectInitialState(state: UseAiStudioResultReturn) {
  expect(state.resultImage).toBeNull();
  expect(state.resultText).toBeNull();
  expect(state.resultMeta).toBeNull();
  expect(state.compareSplit).toBe(50);
  expect(state.revisionSteps).toEqual([]);
  expect(state.revisionCursor).toBe(-1);
  expect(state.saving).toBe(false);
  expect(state.sharing).toBe(false);
  expect(state.canUndoRevision).toBe(false);
  expect(state.canRedoRevision).toBe(false);
  expect(state.hasHiddenResult).toBe(false);
}
