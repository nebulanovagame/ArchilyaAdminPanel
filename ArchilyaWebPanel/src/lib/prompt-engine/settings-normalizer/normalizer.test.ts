import { describe, expect, it } from "vitest";

import { SettingsNormalizer } from "./normalizer";

describe("SettingsNormalizer", () => {
  it("maps golden-hour to the correct atmosphere directive", () => {
    const result = new SettingsNormalizer().normalize({ atmosphere: "golden-hour" });

    expect(result.atmosphere).toEqual({
      timeOfDay: "golden-hour",
      lightQuality: "warm",
      interiorExterior: "unspecified",
      shadowIntensity: "soft",
    });
  });

  it("maps natural-wood to the correct material directive", () => {
    const result = new SettingsNormalizer().normalize({ materialLanguage: "natural-wood" });

    expect(result.materialLanguage).toEqual({
      primaryMaterialFamily: "wood",
      tone: "warm",
      finish: "natural",
      quality: "premium",
    });
  });

  it("maps low to 0.3 style strength", () => {
    const result = new SettingsNormalizer().normalize({ styleStrength: "low" });

    expect(result.styleStrength).toBe(0.3);
  });

  it("falls back gracefully for unknown IDs", () => {
    const result = new SettingsNormalizer().normalize({
      atmosphere: "unknown-atmosphere",
      materialLanguage: "unknown-material",
      styleStrength: "unknown-strength",
    });

    expect(result.atmosphere).toBeUndefined();
    expect(result.materialLanguage).toBeUndefined();
    expect(result.styleStrength).toBeUndefined();
    expect(result.meta).toEqual({
      atmosphere: "unknown-atmosphere",
      materialLanguage: "unknown-material",
      styleStrength: "unknown-strength",
    });
  });

  it("normalizes all supported params and captures original IDs in meta", () => {
    const result = new SettingsNormalizer().normalize({
      atmosphere: "warm-interior",
      materialLanguage: "mixed-premium",
      styleStrength: "high",
      architecturalStyle: "modern minimalism",
    });

    expect(result).toEqual({
      atmosphere: {
        timeOfDay: "unspecified",
        lightQuality: "warm",
        interiorExterior: "interior",
        shadowIntensity: "soft",
      },
      materialLanguage: {
        primaryMaterialFamily: "mixed",
        tone: "warm",
        finish: "satin",
        quality: "premium",
      },
      styleStrength: 0.9,
      architecturalStyle: "modern minimalism",
      meta: {
        atmosphere: "warm-interior",
        materialLanguage: "mixed-premium",
        styleStrength: "high",
        architecturalStyle: "modern minimalism",
      },
    });
  });
});
