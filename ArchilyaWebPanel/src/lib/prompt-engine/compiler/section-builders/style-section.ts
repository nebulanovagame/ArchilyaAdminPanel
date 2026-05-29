import type { CompiledSection, PromptContract } from "../../types";

export function buildStyleSection(contract: PromptContract): CompiledSection {
  const style = contract.styleDirectives;
  const lines: string[] = [];

  if (style.architecturalStyle) {
    lines.push(`Architectural style: ${style.architecturalStyle}.`);
  }

  if (style.atmosphere) {
    lines.push(
      `Atmosphere: time of day ${style.atmosphere.timeOfDay}; light quality ${style.atmosphere.lightQuality}; setting ${style.atmosphere.interiorExterior}; shadow intensity ${style.atmosphere.shadowIntensity}.`,
    );
  }

  if (style.materialLanguage) {
    lines.push(
      `Material: family ${style.materialLanguage.primaryMaterialFamily}; tone ${style.materialLanguage.tone}; finish ${style.materialLanguage.finish}; quality ${style.materialLanguage.quality}.`,
    );
  }

  if (style.lightingStyle) {
    lines.push(
      `Lighting: type ${style.lightingStyle.type}; warmth ${style.lightingStyle.warmth}; intensity ${style.lightingStyle.intensity}; source ${style.lightingStyle.source}.`,
    );
  }

  if (typeof style.styleStrength === "number") {
    lines.push(`Style strength: ${style.styleStrength}.`);
  }

  if (style.colorPalette && style.colorPalette.length > 0) {
    lines.push(`Color palette: ${style.colorPalette.join(", ")}.`);
  }

  if (lines.length === 0) {
    lines.push("No explicit style directives were provided. Preserve the source visual intent while following task requirements.");
  }

  return {
    id: "style-directives",
    priority: "medium",
    heading: "STYLE DIRECTIVES",
    body: lines.join("\n"),
    tokens: 0,
    order: 5,
  };
}
