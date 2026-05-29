import type { CompiledPrompt, InlineImagePart, ProviderAdapter, ProviderFeature, ProviderFormatOptions, ProviderPrompt } from "../types";

const FORBIDDEN_SECTION_ID = "forbidden-actions";
const FORBIDDEN_SECTION_HEADING = "FORBIDDEN ACTIONS";
const PRESERVATION_SECTION_ID = "mandatory-preservation";

type MetadataWithImagePrompt = CompiledPrompt["metadata"] & {
  imagePrompt?: InlineImagePart[];
};

export class FluxAdapter implements ProviderAdapter {
  readonly provider = "flux";
  readonly version = "3.0.0";

  format(compiled: CompiledPrompt, options?: ProviderFormatOptions): ProviderPrompt {
    const positiveSections = compiled.sections.filter((section) => !isForbiddenSection(section));

    return {
      provider: this.provider,
      model: options?.model ?? "flux-1.1-pro",
      userPrompt: positiveSections.map(formatPositiveSection).join(", "),
      negativePrompt: buildNegativePrompt(compiled),
      imagePrompt: getImagePrompt(compiled),
      parameters: {
        guidance_scale: 7.5,
        num_inference_steps: 28,
      },
      sections: compiled.sections,
      promptVersion: this.version,
    };
  }

  getMaxTokens(): number {
    return 512;
  }

  supports(feature: ProviderFeature): boolean {
    return feature === "negative-prompt" || feature === "image-mask";
  }
}

function formatPositiveSection(section: CompiledPrompt["sections"][number]): string {
  const formatted = `${section.heading}: ${section.body}`;

  if (section.priority === "critical") {
    return `MUST: ${formatted}`;
  }

  return formatted;
}

function buildNegativePrompt(compiled: CompiledPrompt): string {
  const forbiddenActions = compiled.sections
    .filter(isForbiddenSection)
    .flatMap((section) => extractForbiddenActions(section.body));
  const lockedZones = extractLockedZones(compiled);
  const parts: string[] = [];

  if (forbiddenActions.length > 0) {
    parts.push(`DO NOT: ${forbiddenActions.join(", ")}`);
  }

  if (lockedZones.length > 0) {
    parts.push(`preserve: ${lockedZones.join(", ")}`);
  }

  return parts.join("; ");
}

function extractForbiddenActions(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-"))
    .map((line) => line.replace(/^-\s*/, ""))
    .map((line) => line.replace(/^do not\s+/i, ""))
    .map((line) => line.replace(/[.\s]+$/, ""))
    .filter(Boolean);
}

function extractLockedZones(compiled: CompiledPrompt): string[] {
  const preservationSection = compiled.sections.find((section) => section.id === PRESERVATION_SECTION_ID);

  if (!preservationSection) {
    return [];
  }

  const lockedZoneLines: string[] = [];
  let isReadingLockedZones = false;

  for (const line of preservationSection.body.split("\n")) {
    const trimmed = line.trim();

    if (trimmed === "LOCKED ZONES:") {
      isReadingLockedZones = true;
      continue;
    }

    if (isReadingLockedZones && /^[A-Z ]+:$/.test(trimmed)) {
      break;
    }

    if (isReadingLockedZones && trimmed.startsWith("-")) {
      lockedZoneLines.push(trimmed);
    }
  }

  return lockedZoneLines
    .map((line) => line.replace(/^-\s*/, ""))
    .map((line) => line.split(":")[0]?.trim() ?? "")
    .filter(Boolean);
}

function isForbiddenSection(section: CompiledPrompt["sections"][number]): boolean {
  return section.id === FORBIDDEN_SECTION_ID || section.heading === FORBIDDEN_SECTION_HEADING;
}

function getImagePrompt(compiled: CompiledPrompt): InlineImagePart[] | undefined {
  return (compiled.metadata as MetadataWithImagePrompt).imagePrompt;
}
