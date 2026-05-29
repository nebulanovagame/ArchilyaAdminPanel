import type { CompiledSection, PromptContract, ReferenceBrief } from "../../types";

function buildReferenceLines(reference: ReferenceBrief, index: number): string[] {
  const lines = [
    `${index + 1}. Reference ${reference.id}`,
    `   - Type: ${reference.type}`,
    `   - Weight: ${reference.weight}`,
    `   - Geometry risk: ${reference.geometryRisk}`,
    `   - Allowed transfer: ${reference.allowedTransfer.length > 0 ? reference.allowedTransfer.join(", ") : "none"}`,
    `   - Forbidden transfer: ${reference.forbiddenTransfer.length > 0 ? reference.forbiddenTransfer.join(", ") : "none"}`,
  ];

  if (reference.styleSummary) {
    lines.push(`   - Style summary: ${reference.styleSummary}`);
  }

  if (reference.materialSummary) {
    lines.push(`   - Material summary: ${reference.materialSummary}`);
  }

  if (reference.lightingSummary) {
    lines.push(`   - Lighting summary: ${reference.lightingSummary}`);
  }

  if (reference.objectSummary) {
    lines.push(`   - Object summary: ${reference.objectSummary}`);
  }

  return lines;
}

export function buildReferenceSection(contract: PromptContract): CompiledSection {
  const lines = [
    "Reference images are for STYLE AND MATERIAL TRANSFER ONLY. They are NOT geometry sources.",
    `Default behavior: ${contract.referencePolicy.defaultBehavior}.`,
  ];

  if (contract.referencePolicy.references.length === 0) {
    lines.push("No reference images were provided.");
  } else {
    lines.push("References:");
    contract.referencePolicy.references.forEach((reference, index) => {
      lines.push(...buildReferenceLines(reference, index));
    });
  }

  return {
    id: "reference-policy",
    priority: "medium",
    heading: "REFERENCE POLICY",
    body: lines.join("\n"),
    tokens: 0,
    order: 6,
  };
}
