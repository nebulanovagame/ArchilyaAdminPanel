// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntakeProvider, useIntakeContext } from "@/stores/intake-store";
import type { Scene, MaterialRef, Moodboard, ClientReference } from "@/lib/types/scene";

function wrapper({ children }: { children: React.ReactNode }) {
  return createElement(IntakeProvider, {}, children);
}

const baseScene: Omit<Scene, "id" | "createdAt"> = {
  label: "Salon",
  direction: "north",
  type: "interior",
  imageFile: null,
  imagePreview: "data:image/png;base64,scene",
  thumbnailUrl: null,
  hasFurnishing: true,
  frameQuality: 90,
  order: 0,
};

const baseMaterial: Omit<MaterialRef, "id" | "createdAt"> = {
  label: "Mermer",
  category: "floor",
  imageFile: null,
  imagePreview: "data:image/png;base64,material",
  order: 0,
};

const baseMoodboard: Omit<Moodboard, "id" | "createdAt"> = {
  label: "Mood 1",
  imageFile: null,
  imagePreview: "data:image/png;base64,mood",
};

const baseClientRef: Omit<ClientReference, "id" | "createdAt"> = {
  label: "Ref 1",
  imageFile: null,
  imagePreview: "data:image/png;base64,ref",
};

describe("intake-store", () => {
  beforeEach(() => {
    localStorage.clear();
    let now = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => {
      now += 1;
      return now;
    });
    let rand = 0.1;
    vi.spyOn(Math, "random").mockImplementation(() => {
      rand += 0.1;
      return rand;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("adds a scene with generated id and timestamp", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addScene(baseScene);
    });
    expect(result.current.scenes).toHaveLength(1);
    expect(result.current.scenes[0].label).toBe("Salon");
    expect(result.current.scenes[0].id).toBeDefined();
    expect(result.current.scenes[0].createdAt).toBeGreaterThan(0);
  });

  it("updates a scene by id", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addScene(baseScene);
    });
    const id = result.current.scenes[0].id;
    act(() => {
      result.current.updateScene(id, { label: "Updated" });
    });
    expect(result.current.scenes[0].label).toBe("Updated");
  });

  it("removes a scene and reorders remaining", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addScene(baseScene);
      result.current.addScene({ ...baseScene, label: "Mutfak", order: 1 });
    });
    const id = result.current.scenes[0].id;
    act(() => {
      result.current.removeScene(id);
    });
    expect(result.current.scenes).toHaveLength(1);
    expect(result.current.scenes[0].label).toBe("Mutfak");
    expect(result.current.scenes[0].order).toBe(0);
  });

  it("reorders scenes", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addScene(baseScene);
      result.current.addScene({ ...baseScene, label: "Mutfak", order: 1 });
    });
    const ids = result.current.scenes.map((s) => s.id);
    act(() => {
      result.current.reorderScenes([ids[1], ids[0]]);
    });
    expect(result.current.scenes[0].label).toBe("Mutfak");
    expect(result.current.scenes[0].order).toBe(0);
    expect(result.current.scenes[1].label).toBe("Salon");
    expect(result.current.scenes[1].order).toBe(1);
  });

  it("adds a material", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addMaterial(baseMaterial);
    });
    expect(result.current.materials).toHaveLength(1);
    expect(result.current.materials[0].label).toBe("Mermer");
  });

  it("updates a material", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addMaterial(baseMaterial);
    });
    const id = result.current.materials[0].id;
    act(() => {
      result.current.updateMaterial(id, { label: "Updated" });
    });
    expect(result.current.materials[0].label).toBe("Updated");
  });

  it("removes a material", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addMaterial(baseMaterial);
      result.current.addMaterial({ ...baseMaterial, label: "Ahşap", order: 1 });
    });
    const id = result.current.materials[0].id;
    act(() => {
      result.current.removeMaterial(id);
    });
    expect(result.current.materials).toHaveLength(1);
    expect(result.current.materials[0].label).toBe("Ahşap");
  });

  it("adds a moodboard", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addMoodboard(baseMoodboard);
    });
    expect(result.current.moodboards).toHaveLength(1);
    expect(result.current.moodboards[0].label).toBe("Mood 1");
  });

  it("removes a moodboard", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addMoodboard(baseMoodboard);
      result.current.addMoodboard({ ...baseMoodboard, label: "Mood 2" });
    });
    const id = result.current.moodboards[0].id;
    act(() => {
      result.current.removeMoodboard(id);
    });
    expect(result.current.moodboards).toHaveLength(1);
    expect(result.current.moodboards[0].label).toBe("Mood 2");
  });

  it("adds a client reference", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addClientReference(baseClientRef);
    });
    expect(result.current.clientReferences).toHaveLength(1);
    expect(result.current.clientReferences[0].label).toBe("Ref 1");
  });

  it("removes a client reference", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addClientReference(baseClientRef);
      result.current.addClientReference({ ...baseClientRef, label: "Ref 2" });
    });
    const id = result.current.clientReferences[0].id;
    act(() => {
      result.current.removeClientReference(id);
    });
    expect(result.current.clientReferences).toHaveLength(1);
    expect(result.current.clientReferences[0].label).toBe("Ref 2");
  });

  it("sets light preference", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.setLightPreference("night");
    });
    expect(result.current.lightPreference).toBe("night");
  });

  it("sets isSubmitting", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.setIsSubmitting(true);
    });
    expect(result.current.isSubmitting).toBe(true);
  });

  it("resets intake state and clears localStorage", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addScene(baseScene);
      result.current.setLightPreference("sunny");
    });
    act(() => {
      result.current.resetIntake();
    });
    expect(result.current.scenes).toHaveLength(0);
    expect(result.current.materials).toHaveLength(0);
    expect(result.current.moodboards).toHaveLength(0);
    expect(result.current.clientReferences).toHaveLength(0);
    expect(result.current.lightPreference).toBeNull();
    expect(result.current.isSubmitting).toBe(false);
    const draftAfterReset = localStorage.getItem("archilya-render-intake-draft");
    expect(draftAfterReset).not.toBeNull();
    expect(JSON.parse(draftAfterReset!).scenes).toHaveLength(0);
    expect(JSON.parse(draftAfterReset!).materials).toHaveLength(0);
  });

  it("persists state to localStorage", () => {
    const { result } = renderHook(() => useIntakeContext(), { wrapper });
    act(() => {
      result.current.addScene(baseScene);
    });
    const draft = localStorage.getItem("archilya-render-intake-draft");
    expect(draft).not.toBeNull();
    const parsed = JSON.parse(draft!);
    expect(parsed.scenes).toHaveLength(1);
    expect(parsed.scenes[0].label).toBe("Salon");
    expect(parsed.scenes[0].imageFile).toBeUndefined();
    expect(parsed.scenes[0].imagePreview).toBeUndefined();
  });

  it("throws when used outside provider", () => {
    expect(() => renderHook(() => useIntakeContext())).toThrow(
      "useIntakeContext must be used within an IntakeProvider.",
    );
  });
});
