import type { ToolConstraintBlock, ToolDSL } from "./types";

export type AnalysisDSLInput = {
  analysisFocus: string[];
  reportTone: string;
};

const OBSERVATION_TARGET_MAP: Record<string, string> = {
  material: "materials-and-finishes",
  light: "lighting-and-shadow",
  composition: "composition-and-framing",
  function: "spatial-functionality",
  presentation: "presentation-quality",
  revision: "revision-opportunities",
};

const CRITIQUE_MODE_MAP: Record<string, string> = {
  professional: "professional-assessment",
  critical: "critical-diagnostic",
  constructive: "constructive-guidance",
  detailed: "detailed-technical-review",
};

const REPORT_STRUCTURE = ["overview", "detailed-findings", "recommendations", "priority-matrix"];

function mapObservationTargets(analysisFocus: string[]): string[] {
  return analysisFocus.map((focus) => OBSERVATION_TARGET_MAP[focus] ?? focus);
}

export class AnalysisDSL implements ToolDSL<AnalysisDSLInput> {
  toolId = "analysis";
  dslVersion = "analysis-v1";

  buildConstraints(params: AnalysisDSLInput): ToolConstraintBlock {
    return {
      toolId: this.toolId,
      dslVersion: this.dslVersion,
      constraints: {
        OBSERVATION_TARGETS: mapObservationTargets(params.analysisFocus),
        CRITIQUE_MODE: CRITIQUE_MODE_MAP[params.reportTone] ?? "professional-assessment",
        REPORT_STRUCTURE,
      },
    };
  }
}
