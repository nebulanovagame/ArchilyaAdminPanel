// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

import { useAiStudioSettings, AiStudioSettingsProvider } from "./use-ai-studio-settings";

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AiStudioSettingsProvider>{children}</AiStudioSettingsProvider>;
  };
}

describe("useAiStudioSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes with default values", () => {
    const { result } = renderHook(() => useAiStudioSettings(), {
      wrapper: createWrapper(),
    });

    expect(result.current.style).toBe("modern");
    expect(result.current.extraNote).toBe("");
    expect(result.current.revisionType).toBe("general");
    expect(result.current.atmosphere).toBe("golden-hour");
    expect(result.current.materialLanguage).toBe("natural-wood");
    expect(result.current.styleStrength).toBe("medium");
    expect(Array.isArray(result.current.enhancePreserve)).toBe(true);
    expect(Array.isArray(result.current.scenePreserveAreas)).toBe(true);
    expect(result.current.planType).toBe("floor-plan");
    expect(result.current.palette).toBe("warm-premium");
    expect(result.current.roomLabels).toBe(true);
    expect(result.current.presentationStyle).toBe("clean-modern");
    expect(result.current.reportTone).toBe("professional");
    expect(Array.isArray(result.current.analysisFocus)).toBe(true);
    expect(Array.isArray(result.current.multiAnglePreserve)).toBe(true);
  });

  it("setStyle updates style", () => {
    const { result } = renderHook(() => useAiStudioSettings(), {
      wrapper: createWrapper(),
    });

    act(() => result.current.setStyle("classic"));
    expect(result.current.style).toBe("classic");
  });

  it("setExtraNote updates extra note", () => {
    const { result } = renderHook(() => useAiStudioSettings(), {
      wrapper: createWrapper(),
    });

    act(() => result.current.setExtraNote("Make it warmer"));
    expect(result.current.extraNote).toBe("Make it warmer");
  });

  it("setAtmosphere updates atmosphere", () => {
    const { result } = renderHook(() => useAiStudioSettings(), {
      wrapper: createWrapper(),
    });

    act(() => result.current.setAtmosphere("twilight"));
    expect(result.current.atmosphere).toBe("twilight");
  });

  it("resetToDefaults reverts all settings to initial values after changes", () => {
    const { result } = renderHook(() => useAiStudioSettings(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.setStyle("brutalist");
      result.current.setExtraNote("test note");
      result.current.setAtmosphere("dramatic-shadow");
      result.current.setMaterialLanguage("stone-marble");
      result.current.setStyleStrength("high");
    });

    expect(result.current.style).toBe("brutalist");
    expect(result.current.extraNote).toBe("test note");

    act(() => result.current.resetToDefaults());

    expect(result.current.style).toBe("modern");
    expect(result.current.extraNote).toBe("");
    expect(result.current.atmosphere).toBe("golden-hour");
    expect(result.current.materialLanguage).toBe("natural-wood");
    expect(result.current.styleStrength).toBe("medium");
  });

  it("preserves independent field state — setting one does not affect others", () => {
    const { result } = renderHook(() => useAiStudioSettings(), {
      wrapper: createWrapper(),
    });

    const initialPalette = result.current.palette;

    act(() => {
      result.current.setPlanType("section");
    });

    expect(result.current.planType).toBe("section");
    // Others should remain unchanged
    expect(result.current.palette).toBe(initialPalette);
    expect(result.current.style).toBe("modern");
    expect(result.current.roomLabels).toBe(true);
  });

  it("handles checklist fields (enhancePreserve) properly", () => {
    const { result } = renderHook(() => useAiStudioSettings(), {
      wrapper: createWrapper(),
    });

    act(() => result.current.setEnhancePreserve(["perspective", "massing"]));
    expect(result.current.enhancePreserve).toEqual(["perspective", "massing"]);

    act(() => result.current.setEnhancePreserve([]));
    expect(result.current.enhancePreserve).toEqual([]);
  });

  it("handles boolean toggle (roomLabels)", () => {
    const { result } = renderHook(() => useAiStudioSettings(), {
      wrapper: createWrapper(),
    });

    act(() => result.current.setRoomLabels(false));
    expect(result.current.roomLabels).toBe(false);

    act(() => result.current.setRoomLabels(true));
    expect(result.current.roomLabels).toBe(true);
  });
});
