import { describe, expect, it } from "vitest";

import type { CompiledPrompt, ProviderName } from "../types";
import { getProviderAdapter } from "./adapter-registry";
import { FluxAdapter } from "./flux-adapter";
import { GeminiAdapter } from "./gemini-adapter";

describe("provider adapters", () => {
  it("formats Gemini prompts with system and user prompts", () => {
    const adapter = new GeminiAdapter();
    const prompt = adapter.format(createCompiledPrompt());

    expect(prompt.provider).toBe("gemini");
    expect(prompt.model).toBe("gemini-2.5-flash");
    expect(prompt.systemPrompt).toContain("You are an ARCHITECTURAL RENDERING SPECIALIST.");
    expect(prompt.systemPrompt).toContain("=== TASK DEFINITION ===\nRender a refined architectural scene.\n");
    expect(prompt.systemPrompt).toContain("=== MANDATORY PRESERVATION ===");
    expect(prompt.systemPrompt).toContain("=== FORBIDDEN ACTIONS ===");
    expect(prompt.systemPrompt).toContain("IMPORTANT: Violating these constraints will result in REJECTION.");
    expect(prompt.userPrompt).toContain("=== STYLE DIRECTIVES ===\nUse warm modern minimalism.\n");
    expect(prompt.userPrompt).toContain("=== REFERENCE POLICY ===\nTransfer materials only.\n");
    expect(prompt.parameters).toEqual({ temperature: 0.4 });
    expect(prompt.promptVersion).toBe("3.0.0");
  });

  it("formats Flux prompts with positive and negative prompts", () => {
    const adapter = new FluxAdapter();
    const prompt = adapter.format(createCompiledPrompt());

    expect(prompt.provider).toBe("flux");
    expect(prompt.model).toBe("flux-1.1-pro");
    expect(prompt.userPrompt).toContain("MUST: TASK DEFINITION: Render a refined architectural scene.");
    expect(prompt.userPrompt).toContain("MUST: MANDATORY PRESERVATION:");
    expect(prompt.userPrompt).not.toContain("FORBIDDEN ACTIONS");
    expect(prompt.negativePrompt).toContain("DO NOT: change the camera angle, add windows");
    expect(prompt.negativePrompt).toContain("preserve: Existing walls, Window positions");
    expect(prompt.parameters).toEqual({ guidance_scale: 7.5, num_inference_steps: 28 });
    expect(prompt.promptVersion).toBe("3.0.0");
  });

  it("reports Gemini support without negative prompts", () => {
    const adapter = new GeminiAdapter();

    expect(adapter.supports("system-prompt")).toBe(true);
    expect(adapter.supports("multi-image")).toBe(true);
    expect(adapter.supports("negative-prompt")).toBe(false);
    expect(adapter.supports("image-mask")).toBe(false);
  });

  it("reports Flux support with negative prompts", () => {
    const adapter = new FluxAdapter();

    expect(adapter.supports("negative-prompt")).toBe(true);
    expect(adapter.supports("image-mask")).toBe(true);
    expect(adapter.supports("system-prompt")).toBe(false);
    expect(adapter.supports("multi-image")).toBe(false);
  });

  it("returns registered provider adapters", () => {
    expect(getProviderAdapter("gemini")).toBeInstanceOf(GeminiAdapter);
    expect(getProviderAdapter("flux")).toBeInstanceOf(FluxAdapter);
  });

  it("throws for unsupported providers", () => {
    expect(() => getProviderAdapter("unknown" as ProviderName)).toThrow("Unsupported prompt provider: unknown");
  });
});

function createCompiledPrompt(): CompiledPrompt {
  return {
    version: "3.0.0",
    compilerVersion: "3.0.0",
    sections: [
      {
        id: "task-definition",
        priority: "critical",
        heading: "TASK DEFINITION",
        body: "Render a refined architectural scene.",
        tokens: 8,
        order: 0,
      },
      {
        id: "mandatory-preservation",
        priority: "critical",
        heading: "MANDATORY PRESERVATION",
        body: [
          "These elements MUST remain identical to the input image:",
          "- [CRITICAL] camera-transform: Keep the camera unchanged.",
          "",
          "LOCKED ZONES:",
          "- Existing walls: Structural boundaries must remain fixed.",
          "- Window positions: Existing openings must remain fixed.",
          "",
          "EDITABLE ZONES:",
          "- Furniture: allowed changes: material; max intensity: moderate.",
        ].join("\n"),
        tokens: 32,
        order: 1,
      },
      {
        id: "forbidden-actions",
        priority: "critical",
        heading: "FORBIDDEN ACTIONS",
        body: ["DO NOT under any circumstances:", "- Do not change the camera angle.", "- Do not add windows."].join("\n"),
        tokens: 14,
        order: 2,
      },
      {
        id: "style-directives",
        priority: "medium",
        heading: "STYLE DIRECTIVES",
        body: "Use warm modern minimalism.",
        tokens: 6,
        order: 3,
      },
      {
        id: "reference-policy",
        priority: "informational",
        heading: "REFERENCE POLICY",
        body: "Transfer materials only.",
        tokens: 5,
        order: 4,
      },
    ],
    metadata: {
      contractHash: "contract-test",
      compiledAt: "2026-01-02T03:04:05.000Z",
      toolId: "img2img",
      sectionCount: 5,
      totalTokens: 65,
    },
  };
}
