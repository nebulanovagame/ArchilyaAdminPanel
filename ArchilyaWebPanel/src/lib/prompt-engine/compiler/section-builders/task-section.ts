import type { CompiledSection, PromptContract } from "../../types";

export function buildTaskSection(contract: PromptContract): CompiledSection {
  const surgicalNote = contract.task.editScope === "surgical"
    ? "\nSURGICAL EDIT NOTE: Modify only explicitly editable zones; preserve all non-target areas."
    : "";

  const body = [
    `You are performing a ${contract.task.type} on an architectural rendering.`,
    `PRIMARY GOAL: ${contract.task.primaryGoal}`,
    `ARCHITECTURAL MODE: ${contract.task.architecturalMode}${surgicalNote}`,
  ].join("\n");

  return {
    id: "task-definition",
    priority: "critical",
    heading: "TASK DEFINITION",
    body,
    tokens: 0,
    order: 0,
  };
}
