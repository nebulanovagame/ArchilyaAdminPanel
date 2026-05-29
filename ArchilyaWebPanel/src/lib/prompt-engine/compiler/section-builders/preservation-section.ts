import type { CompiledSection, PromptContract } from "../../types";

function formatRulePriority(priority: string): string {
  return priority.toUpperCase();
}

export function buildPreservationSection(contract: PromptContract): CompiledSection {
  const preservation = contract.architecturalPreservation;
  const lines = ["These elements MUST remain identical to the input image:"];

  for (const rule of preservation.mandatory) {
    lines.push(`- [${formatRulePriority(rule.priority)}] ${rule.element}: ${rule.description}`);
  }

  if (preservation.preferred.length > 0) {
    lines.push("", "STRONGLY PREFERRED:");
    for (const rule of preservation.preferred) {
      lines.push(`- [${formatRulePriority(rule.priority)}] ${rule.element}: ${rule.description}`);
    }
  }

  if (preservation.lockedZones.length > 0) {
    lines.push("", "LOCKED ZONES:");
    for (const zone of preservation.lockedZones) {
      lines.push(`- ${zone.name}: ${zone.reason}`);
    }
  }

  if (preservation.editableZones.length > 0) {
    lines.push("", "EDITABLE ZONES:");
    for (const zone of preservation.editableZones) {
      lines.push(
        `- ${zone.name}: allowed changes: ${zone.allowedChanges.join(", ")}; max intensity: ${zone.maxChangeIntensity}.`,
      );
    }
  }

  return {
    id: "mandatory-preservation",
    priority: "critical",
    heading: "MANDATORY PRESERVATION",
    body: lines.join("\n"),
    tokens: 0,
    order: 1,
  };
}
