import type { CompiledSection, PromptContract } from "../../types";

export function buildAnalysisSection(contract: PromptContract): CompiledSection | undefined {
  if (!contract.analysisDirectives) {
    return undefined;
  }

  const { analysisDirectives } = contract;
  const body = [
    `Focus areas: ${analysisDirectives.focus.join(", ")}.`,
    `Tone: ${analysisDirectives.tone}.`,
    `Depth: ${analysisDirectives.depth}.`,
  ].join("\n");

  return {
    id: "analysis-directives",
    priority: "medium",
    heading: "ANALYSIS DIRECTIVES",
    body,
    tokens: 0,
    order: 7,
  };
}
