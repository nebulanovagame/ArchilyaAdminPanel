import type { AiStudioToolId } from "@/lib/ai-studio/tools";

import type {
  AnalysisDirectives,
  ArchitecturalMode,
  ArchitecturalPreservationContract,
  ContractBuilderInput,
  PromptContract,
  ReferenceBrief,
  ReferencePolicy,
  StyleDirectives,
  TaskDirective,
  TaskType,
  ToolConstraintBlock,
} from "../types";
import { getToolDefaultPreservation } from "./architectural-contract";

type ToolTaskDefault = {
  type: TaskType;
  primaryGoal: string;
  architecturalMode: ArchitecturalMode;
  editScope?: TaskDirective["editScope"];
};

const TOOL_TASK_DEFAULTS: Record<AiStudioToolId, ToolTaskDefault> = {
  img2img: {
    type: "architectural-render",
    primaryGoal: "Transform architectural visualization with style and atmosphere",
    architecturalMode: "preserve",
    editScope: "full",
  },
  enhance: {
    type: "style-transfer",
    primaryGoal: "Transfer reference style while preserving geometry",
    architecturalMode: "enhance",
    editScope: "full",
  },
  sceneedit: {
    type: "scene-edit",
    primaryGoal: "Apply targeted edits to specific zones only",
    architecturalMode: "edit",
    editScope: "surgical",
  },
  "multi-angle": {
    type: "multi-angle",
    primaryGoal: "Generate new camera angle with identical design DNA",
    architecturalMode: "preserve",
    editScope: "full",
  },
  analysis: {
    type: "analysis",
    primaryGoal: "Analyze architectural rendering quality and composition",
    architecturalMode: "analyze",
  },
  plancolor: {
    type: "plan-color",
    primaryGoal: "Colorize architectural floor plan for presentation",
    architecturalMode: "enhance",
    editScope: "full",
  },
};

export class ContractBuilder {
  build(input: ContractBuilderInput): PromptContract {
    if (!input.toolId) {
      throw new Error("ContractBuilder requires toolId");
    }

    const contract: PromptContract = {
      version: "3.0.0",
      toolId: input.toolId,
      task: this.buildTaskDirective(input),
      architecturalPreservation: this.buildPreservation(input.toolId, input),
      styleDirectives: this.buildStyleDirectives(input),
      referencePolicy: this.buildReferencePolicy(input.references),
      toolConstraints: this.buildToolConstraints(input.toolId, input.toolConstraints),
      analysisDirectives: this.buildAnalysisDirectives(input),
      variant: input.variant ?? "default",
      userNote: input.userNote,
    };

    void this.generateHash(contract);

    return contract;
  }

  private buildTaskDirective(input: ContractBuilderInput): TaskDirective {
    const defaults = TOOL_TASK_DEFAULTS[input.toolId];

    if (!defaults) {
      throw new Error(`Unsupported prompt engine toolId: ${input.toolId}`);
    }

    return {
      ...defaults,
      ...input.task,
    };
  }

  private buildPreservation(
    toolId: AiStudioToolId,
    input: ContractBuilderInput,
  ): ArchitecturalPreservationContract {
    const defaults = getToolDefaultPreservation(toolId);
    const overrides = input.preservation;

    return {
      mandatory: overrides?.mandatory ?? defaults.mandatory,
      preferred: overrides?.preferred ?? defaults.preferred,
      forbidden: overrides?.forbidden ?? defaults.forbidden,
      lockedZones: overrides?.lockedZones ?? defaults.lockedZones,
      editableZones: overrides?.editableZones ?? defaults.editableZones,
    };
  }

  private buildStyleDirectives(input: ContractBuilderInput): StyleDirectives {
    const style = input.style ?? {};

    return {
      architecturalStyle: style.architecturalStyle,
      atmosphere: style.atmosphere,
      materialLanguage: style.materialLanguage,
      lightingStyle: style.lightingStyle,
      styleStrength: style.styleStrength,
      colorPalette: style.colorPalette,
    };
  }

  private buildReferencePolicy(references: ReferenceBrief[] = []): ReferencePolicy {
    return {
      references,
      defaultBehavior: "style-and-material-only",
    };
  }

  private buildToolConstraints(
    toolId: AiStudioToolId,
    constraints: Record<string, unknown> = {},
  ): ToolConstraintBlock {
    return {
      toolId,
      dslVersion: "3.0.0",
      constraints,
    };
  }

  private buildAnalysisDirectives(input: ContractBuilderInput): AnalysisDirectives | undefined {
    if (!input.analysisDirectives && input.toolId !== "analysis") {
      return undefined;
    }

    const defaults: AnalysisDirectives = {
      focus: ["composition", "presentation"],
      tone: "professional",
      depth: "moderate",
    };

    return {
      ...defaults,
      ...input.analysisDirectives,
    };
  }

  private generateHash(contract: PromptContract): string {
    const serialized = JSON.stringify(contract);

    return `contract-${serialized.length}`;
  }
}
