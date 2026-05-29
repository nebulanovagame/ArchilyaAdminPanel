import type { AtmosphereDirective, MaterialDirective } from "../types";

export const ATMOSPHERE_MAPPINGS: Record<string, AtmosphereDirective> = {
  "golden-hour": {
    timeOfDay: "golden-hour",
    lightQuality: "warm",
    interiorExterior: "unspecified",
    shadowIntensity: "soft",
  },
  "natural-daylight": {
    timeOfDay: "midday",
    lightQuality: "neutral",
    interiorExterior: "unspecified",
    shadowIntensity: "medium",
  },
  twilight: {
    timeOfDay: "twilight",
    lightQuality: "cool",
    interiorExterior: "unspecified",
    shadowIntensity: "medium",
  },
  "overcast-soft": {
    timeOfDay: "overcast",
    lightQuality: "neutral",
    interiorExterior: "unspecified",
    shadowIntensity: "soft",
  },
  "warm-interior": {
    timeOfDay: "unspecified",
    lightQuality: "warm",
    interiorExterior: "interior",
    shadowIntensity: "soft",
  },
  "cool-modern": {
    timeOfDay: "unspecified",
    lightQuality: "cool",
    interiorExterior: "interior",
    shadowIntensity: "medium",
  },
  "dramatic-shadow": {
    timeOfDay: "unspecified",
    lightQuality: "dramatic",
    interiorExterior: "unspecified",
    shadowIntensity: "hard",
  },
  "sunny-morning": {
    timeOfDay: "morning",
    lightQuality: "warm",
    interiorExterior: "unspecified",
    shadowIntensity: "soft",
  },
};

export const MATERIAL_MAPPINGS: Record<string, MaterialDirective> = {
  "natural-wood": {
    primaryMaterialFamily: "wood",
    tone: "warm",
    finish: "natural",
    quality: "premium",
  },
  "stone-marble": {
    primaryMaterialFamily: "stone",
    tone: "cool",
    finish: "glossy",
    quality: "premium",
  },
  "metal-glass": {
    primaryMaterialFamily: "mixed",
    tone: "cool",
    finish: "satin",
    quality: "premium",
  },
  "concrete-minimal": {
    primaryMaterialFamily: "concrete",
    tone: "neutral",
    finish: "matte",
    quality: "standard",
  },
  "warm-textile": {
    primaryMaterialFamily: "textile",
    tone: "warm",
    finish: "natural",
    quality: "premium",
  },
  "mixed-premium": {
    primaryMaterialFamily: "mixed",
    tone: "warm",
    finish: "satin",
    quality: "premium",
  },
};

export const STYLE_STRENGTH_MAPPINGS: Record<string, number> = {
  low: 0.3,
  medium: 0.6,
  high: 0.9,
};
