// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * IMPORTANT: revisionType is now owned by AiStudioSettingsProvider context,
 * NOT by useAiStudioToolSelection. Tests here verify only tool/selection state.
 */
const mocks = vi.hoisted(() => ({
  t: vi.fn((key: string) => key),
  toast: { success: vi.fn() },
  restorePrompt: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => mocks.t }));
vi.mock("react-hot-toast", () => ({ default: mocks.toast }));

import { useAiStudioToolSelection } from "./use-ai-studio-tool-selection";
import type { ToolConfig } from "../types";

describe("useAiStudioToolSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with null selectedTool and scene-compose", () => {
    const { result } = renderHook(() => useAiStudioToolSelection());

    expect(result.current.selectedTool).toBeNull();
    expect(result.current.sceneEditMode).toBe("scene-compose");
  });

  it("selectTool sets selectedTool without resetting sceneEditMode", () => {
    const { result } = renderHook(() => useAiStudioToolSelection());

    const img2img = { id: "img2img" } as ToolConfig;

    act(() => {
      result.current.selectTool(img2img);
    });

    expect(result.current.selectedTool?.id).toBe("img2img");
    // sceneEditMode is NOT reset
    expect(result.current.sceneEditMode).toBe("scene-compose");
  });

  it("sceneEditMode persists across tool switches", () => {
    const { result } = renderHook(() => useAiStudioToolSelection());

    act(() => {
      result.current.setSceneEditMode("scene-replace");
    });
    expect(result.current.sceneEditMode).toBe("scene-replace");

    act(() => {
      result.current.selectTool({ id: "enhance" } as ToolConfig);
    });
    expect(result.current.sceneEditMode).toBe("scene-replace");

    act(() => {
      result.current.selectTool({ id: "img2img" } as ToolConfig);
    });
    // Still preserved
    expect(result.current.sceneEditMode).toBe("scene-replace");
  });

  it("setSelectedTool directly updates selectedTool", () => {
    const { result } = renderHook(() => useAiStudioToolSelection());

    act(() => {
      result.current.setSelectedTool({ id: "analysis" } as ToolConfig);
    });

    expect(result.current.selectedTool?.id).toBe("analysis");
  });

  it("applyPromptHistory switches to the entry's tool", () => {
    const { result } = renderHook(() => useAiStudioToolSelection());

    act(() => {
      result.current.applyPromptHistory({
        id: "entry-1",
        toolId: "plancolor",
        toolLabel: "Plan Color",
        outputType: "image",
        style: "modern",
        sceneEditMode: "scene-compose",
        referenceCount: 0,
        extraNote: "",
        generationVariant: "default",
        statusLabel: "done",
        createdAt: new Date().toISOString(),
      });
    });

    // Tool switches immediately
    expect(result.current.selectedTool?.id).toBe("plancolor");
  });

  it("applyPromptHistory calls toast on success", () => {
    const { result } = renderHook(() => useAiStudioToolSelection());

    act(() => {
      result.current.applyPromptHistory({
        id: "entry-1",
        toolId: "plancolor",
        toolLabel: "Plan Color",
        outputType: "image",
        style: "modern",
        sceneEditMode: "scene-compose",
        referenceCount: 0,
        extraNote: "",
        generationVariant: "default",
        statusLabel: "done",
        createdAt: new Date().toISOString(),
      });
    });

    expect(mocks.toast.success).toHaveBeenCalledWith("dashboard.aiStudio.promptRestored");
  });

  it("returns correct state shape", () => {
    const { result } = renderHook(() => useAiStudioToolSelection());

    expect(result.current).toHaveProperty("selectedTool");
    expect(result.current).toHaveProperty("sceneEditMode");
    expect(result.current).toHaveProperty("setSelectedTool");
    expect(result.current).toHaveProperty("setSceneEditMode");
    expect(result.current).toHaveProperty("selectTool");
    expect(result.current).toHaveProperty("applyPromptHistory");
  });
});
