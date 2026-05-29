import type { CompiledPrompt, InlineImagePart, ProviderAdapter, ProviderFeature, ProviderFormatOptions, ProviderPrompt } from "../types";

const SYSTEM_SECTION_PRIORITIES = new Set(["critical", "high"]);
const USER_SECTION_PRIORITIES = new Set(["medium", "low", "informational"]);

type MetadataWithImagePrompt = CompiledPrompt["metadata"] & {
  imagePrompt?: InlineImagePart[];
};

export class GeminiAdapter implements ProviderAdapter {
  readonly provider = "gemini";
  readonly version = "3.0.0";

  format(compiled: CompiledPrompt, options?: ProviderFormatOptions): ProviderPrompt {
    const systemSections = compiled.sections.filter((section) => SYSTEM_SECTION_PRIORITIES.has(section.priority));
    const userSections = compiled.sections.filter((section) => USER_SECTION_PRIORITIES.has(section.priority));

    return {
      provider: this.provider,
      model: options?.model ?? "gemini-2.5-flash",
      systemPrompt: formatSystemPrompt(systemSections),
      userPrompt: formatSections(userSections),
      imagePrompt: getImagePrompt(compiled),
      parameters: {
        temperature: options?.temperature ?? 0.4,
      },
      sections: compiled.sections,
      promptVersion: this.version,
    };
  }

  getMaxTokens(model?: string): number {
    if (model === "gemini-2.5-pro") {
      return 2_097_152;
    }

    return 1_048_576;
  }

  supports(feature: ProviderFeature): boolean {
    return feature === "multi-image" || feature === "system-prompt";
  }
}

function formatSystemPrompt(sections: CompiledPrompt["sections"]): string {
  return [
    "You are an ARCHITECTURAL RENDERING SPECIALIST.",
    formatSections(sections),
    "IMPORTANT: Violating these constraints will result in REJECTION.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function formatSections(sections: CompiledPrompt["sections"]): string {
  return sections.map((section) => `=== ${section.heading} ===\n${section.body}\n`).join("\n");
}

function getImagePrompt(compiled: CompiledPrompt): InlineImagePart[] | undefined {
  return (compiled.metadata as MetadataWithImagePrompt).imagePrompt;
}
