// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MarkupProvider, useMarkupContext } from "@/stores/markup-store";
import type { Annotation, Constraint } from "@/lib/types/markup";

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(MarkupProvider, {}, children);
}

const annotation: Annotation = {
  id: "annotation-1",
  type: "circle",
  coordinates: { x: 10, y: 10, width: 30, height: 30 },
  color: "#FF4757",
  strokeWidth: 4,
  label: "circle",
};

describe("markup-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("adds an annotation and builds a constraint", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.addAnnotation(annotation, "scene-1");
    });
    expect(result.current.annotations).toHaveLength(1);
    expect(result.current.constraints).toHaveLength(1);
    expect(result.current.constraints[0].sceneId).toBe("scene-1");
    expect(result.current.constraints[0].annotationId).toBe(annotation.id);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("removes an annotation and its constraint", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.addAnnotation(annotation, "scene-1");
    });
    act(() => {
      result.current.removeAnnotation(annotation.id);
    });
    expect(result.current.annotations).toHaveLength(0);
    expect(result.current.constraints).toHaveLength(0);
  });

  it("undoes the last annotation action", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.addAnnotation(annotation, "scene-1");
    });
    act(() => {
      result.current.undoAnnotation();
    });
    expect(result.current.annotations).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("redoes a previously undone action", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.addAnnotation(annotation, "scene-1");
    });
    act(() => {
      result.current.undoAnnotation();
    });
    act(() => {
      result.current.redoAnnotation();
    });
    expect(result.current.annotations).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("updates a constraint", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.addAnnotation(annotation, "scene-1");
    });
    act(() => {
      result.current.updateConstraint(annotation.id, { description: "Updated" });
    });
    expect(result.current.constraints[0].description).toBe("Updated");
  });

  it("sets constraints directly", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    const newConstraints: Constraint[] = [
      {
        id: "c-1",
        annotationId: "a-1",
        sceneId: "scene-1",
        type: "CHANGE",
        targetArea: "wall",
        description: "Paint it blue",
        confidence: 0.9,
      },
    ];
    act(() => {
      result.current.setConstraints(newConstraints);
    });
    expect(result.current.constraints).toHaveLength(1);
    expect(result.current.constraints[0].description).toBe("Paint it blue");
  });

  it("sets active scene id", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.setActiveSceneId("scene-2");
    });
    expect(result.current.activeSceneId).toBe("scene-2");
  });

  it("sets selected tool", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.setSelectedTool("arrow");
    });
    expect(result.current.selectedTool).toBe("arrow");
  });

  it("sets color and stroke width", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.setColor("#000000");
      result.current.setStrokeWidth(8);
    });
    expect(result.current.color).toBe("#000000");
    expect(result.current.strokeWidth).toBe(8);
  });

  it("sets isProcessing", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.setIsProcessing(true);
    });
    expect(result.current.isProcessing).toBe(true);
  });

  it("resets markup state and clears localStorage", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.addAnnotation(annotation, "scene-1");
      result.current.setActiveSceneId("scene-1");
      result.current.setColor("#000000");
    });
    act(() => {
      result.current.resetMarkup();
    });
    expect(result.current.annotations).toHaveLength(0);
    expect(result.current.constraints).toHaveLength(0);
    expect(result.current.activeSceneId).toBeNull();
    expect(result.current.selectedTool).toBe("freehand");
    expect(result.current.color).toBe("#FF4757");
    expect(result.current.strokeWidth).toBe(4);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    const draftAfterReset = localStorage.getItem("archilya-render-markup-draft");
    expect(draftAfterReset).not.toBeNull();
    expect(JSON.parse(draftAfterReset!).annotations).toHaveLength(0);
  });

  it("persists state to localStorage", () => {
    const { result } = renderHook(() => useMarkupContext(), { wrapper });
    act(() => {
      result.current.addAnnotation(annotation, "scene-1");
    });
    const draft = localStorage.getItem("archilya-render-markup-draft");
    expect(draft).not.toBeNull();
    const parsed = JSON.parse(draft!);
    expect(parsed.annotations).toHaveLength(1);
    expect(parsed.constraints).toHaveLength(1);
  });

  it("throws when used outside provider", () => {
    expect(() => renderHook(() => useMarkupContext())).toThrow(
      "useMarkupContext must be used within a MarkupProvider.",
    );
  });
});
