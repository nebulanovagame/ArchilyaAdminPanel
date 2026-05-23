// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SpatialProvider, useSpatialContext } from "@/stores/spatial-store";
import type { DepthMap, MetricLock, ConsistencyResult } from "@/lib/types/spatial";

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(SpatialProvider, {}, children);
}

describe("spatial-store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("sets a depth map", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    const depthMap: DepthMap = {
      sceneId: "scene-1",
      imageUrl: "https://example.com/image.png",
      depthDataUrl: "https://example.com/depth.png",
      generatedAt: 1000,
    };
    act(() => {
      result.current.setDepthMap(depthMap);
    });
    expect(result.current.depthMaps["scene-1"]).toEqual(depthMap);
  });

  it("sets a metric lock", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    const lock: MetricLock = {
      sceneId: "scene-1",
      aspectRatio: 1.5,
      estimatedDepth: 10,
      volumeScore: 85,
      isLocked: false,
    };
    act(() => {
      result.current.setMetricLock(lock);
    });
    expect(result.current.metricLocks["scene-1"]).toEqual(lock);
  });

  it("locks a scene", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    const lock: MetricLock = {
      sceneId: "scene-1",
      aspectRatio: 1.5,
      estimatedDepth: 10,
      volumeScore: 85,
      isLocked: false,
    };
    act(() => {
      result.current.setMetricLock(lock);
      result.current.lockScene("scene-1");
    });
    expect(result.current.metricLocks["scene-1"].isLocked).toBe(true);
  });

  it("does nothing when locking a non-existent scene", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    act(() => {
      result.current.lockScene("missing");
    });
    expect(result.current.metricLocks).toEqual({});
  });

  it("computes allScenesLocked correctly when all are locked", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    act(() => {
      result.current.setMetricLock({
        sceneId: "scene-1",
        aspectRatio: 1.5,
        estimatedDepth: 10,
        volumeScore: 85,
        isLocked: true,
      });
      result.current.setMetricLock({
        sceneId: "scene-2",
        aspectRatio: 2,
        estimatedDepth: 8,
        volumeScore: 90,
        isLocked: true,
      });
    });
    expect(result.current.allScenesLocked).toBe(true);
  });

  it("computes allScenesLocked as false when some are unlocked", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    act(() => {
      result.current.setMetricLock({
        sceneId: "scene-1",
        aspectRatio: 1.5,
        estimatedDepth: 10,
        volumeScore: 85,
        isLocked: true,
      });
      result.current.setMetricLock({
        sceneId: "scene-2",
        aspectRatio: 2,
        estimatedDepth: 8,
        volumeScore: 90,
        isLocked: false,
      });
    });
    expect(result.current.allScenesLocked).toBe(false);
  });

  it("computes allScenesLocked as false when no locks exist", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    expect(result.current.allScenesLocked).toBe(false);
  });

  it("sets consistency result", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    const resultData: ConsistencyResult = {
      sceneIds: ["scene-1"],
      consistencyScore: 95,
      warnings: [],
    };
    act(() => {
      result.current.setConsistencyResult(resultData);
    });
    expect(result.current.consistencyResult).toEqual(resultData);
  });

  it("sets isGenerating", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    act(() => {
      result.current.setIsGenerating(true);
    });
    expect(result.current.isGenerating).toBe(true);
  });

  it("resets spatial state and clears localStorage", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    act(() => {
      result.current.setDepthMap({
        sceneId: "scene-1",
        imageUrl: "https://example.com/image.png",
        depthDataUrl: "https://example.com/depth.png",
        generatedAt: 1000,
      });
      result.current.setConsistencyResult({
        sceneIds: ["scene-1"],
        consistencyScore: 95,
        warnings: [],
      });
    });
    act(() => {
      result.current.resetSpatial();
    });
    expect(Object.keys(result.current.depthMaps)).toHaveLength(0);
    expect(Object.keys(result.current.metricLocks)).toHaveLength(0);
    expect(result.current.consistencyResult).toBeNull();
    expect(result.current.isGenerating).toBe(false);
    const draftAfterReset = localStorage.getItem("archilya-render-spatial-draft");
    expect(draftAfterReset).not.toBeNull();
    expect(JSON.parse(draftAfterReset!).depthMaps).toEqual({});
  });

  it("persists state to localStorage", () => {
    const { result } = renderHook(() => useSpatialContext(), { wrapper });
    act(() => {
      result.current.setDepthMap({
        sceneId: "scene-1",
        imageUrl: "https://example.com/image.png",
        depthDataUrl: "https://example.com/depth.png",
        generatedAt: 1000,
      });
    });
    const draft = localStorage.getItem("archilya-render-spatial-draft");
    expect(draft).not.toBeNull();
    const parsed = JSON.parse(draft!);
    expect(parsed.depthMaps["scene-1"]).toBeDefined();
    expect(parsed.depthMaps["scene-1"].sceneId).toBe("scene-1");
  });

  it("throws when used outside provider", () => {
    expect(() => renderHook(() => useSpatialContext())).toThrow(
      "useSpatialContext must be used within a SpatialProvider.",
    );
  });
});
