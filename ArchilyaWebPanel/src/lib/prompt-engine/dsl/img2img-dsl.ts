import type { ToolConstraintBlock, ToolDSL } from "./types";

export type Img2imgDSLInput = {
  style: string;
  atmosphere: string;
  materialLanguage: string;
};

type AtmosphereConstraint = {
  timeOfDay: string;
  lightQuality: string;
  interiorExterior: string;
  shadowIntensity: string;
};

type MaterialConstraint = {
  primaryMaterialFamily: string;
  tone: string;
  finish: string;
  quality: string;
};

const ATMOSPHERE_MAP: Record<string, AtmosphereConstraint> = {
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
    shadowIntensity: "soft",
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
    shadowIntensity: "medium",
  },
};

const MATERIAL_MAP: Record<string, MaterialConstraint> = {
  "natural-wood": {
    primaryMaterialFamily: "wood",
    tone: "warm",
    finish: "natural",
    quality: "premium",
  },
  "stone-marble": {
    primaryMaterialFamily: "stone",
    tone: "neutral",
    finish: "satin",
    quality: "premium",
  },
  "metal-glass": {
    primaryMaterialFamily: "mixed",
    tone: "cool",
    finish: "glossy",
    quality: "premium",
  },
  "concrete-minimal": {
    primaryMaterialFamily: "concrete",
    tone: "neutral",
    finish: "matte",
    quality: "premium",
  },
  "warm-textile": {
    primaryMaterialFamily: "textile",
    tone: "warm",
    finish: "matte",
    quality: "premium",
  },
  "mixed-premium": {
    primaryMaterialFamily: "mixed",
    tone: "neutral",
    finish: "satin",
    quality: "premium",
  },
};

const STYLE_MAP: Record<string, string> = {
  modern: "modern-minimal",
  luxury: "warm-luxury",
  scandinavian: "scandinavian-calm",
  brutalist: "soft-brutalist",
  mediterranean: "mediterranean",
  japandi: "japandi",
  "natural-stone": "natural-stone",
  contemporary: "contemporary-villa",
};

export class Img2imgDSL implements ToolDSL<Img2imgDSLInput> {
  toolId = "img2img";
  dslVersion = "img2img-v1";

  buildConstraints(params: Img2imgDSLInput): ToolConstraintBlock {
    return {
      toolId: this.toolId,
      dslVersion: this.dslVersion,
      constraints: {
        RENDER_MODE: "premium-architectural",
        ATMOSPHERE: ATMOSPHERE_MAP[params.atmosphere] ?? ATMOSPHERE_MAP["natural-daylight"],
        MATERIAL: MATERIAL_MAP[params.materialLanguage] ?? MATERIAL_MAP["mixed-premium"],
        STYLE: {
          id: params.style,
          directive: STYLE_MAP[params.style] ?? "user-selected-architectural-style",
        },
      },
    };
  }
}
