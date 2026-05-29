import type { NormalizedSettings } from "./types";
import { ATMOSPHERE_MAPPINGS, MATERIAL_MAPPINGS, STYLE_STRENGTH_MAPPINGS } from "./mappings";

export interface NormalizerInput {
  atmosphere?: string;
  materialLanguage?: string;
  styleStrength?: string;
  architecturalStyle?: string;
}

export class SettingsNormalizer {
  normalize(params: NormalizerInput): NormalizedSettings {
    const normalized: NormalizedSettings = {
      meta: this.buildMeta(params),
    };

    const atmosphere = params.atmosphere ? ATMOSPHERE_MAPPINGS[params.atmosphere] : undefined;
    const materialLanguage = params.materialLanguage
      ? MATERIAL_MAPPINGS[params.materialLanguage]
      : undefined;
    const styleStrength = params.styleStrength
      ? STYLE_STRENGTH_MAPPINGS[params.styleStrength]
      : undefined;

    if (atmosphere) {
      normalized.atmosphere = atmosphere;
    }

    if (materialLanguage) {
      normalized.materialLanguage = materialLanguage;
    }

    if (styleStrength !== undefined) {
      normalized.styleStrength = styleStrength;
    }

    if (params.architecturalStyle) {
      normalized.architecturalStyle = params.architecturalStyle;
    }

    return normalized;
  }

  private buildMeta(params: NormalizerInput): Record<string, string> {
    return Object.fromEntries(
      Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
  }
}
