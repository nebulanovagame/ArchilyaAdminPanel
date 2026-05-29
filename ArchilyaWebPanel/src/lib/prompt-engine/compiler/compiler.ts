import type { CompiledPrompt, CompiledSection, PromptCompiler as PromptCompilerInterface, PromptContract } from "../types";
import { buildAnalysisSection } from "./section-builders/analysis-section";
import { buildForbiddenSection } from "./section-builders/forbidden-section";
import { buildPreservationSection } from "./section-builders/preservation-section";
import { buildReferenceSection } from "./section-builders/reference-section";
import { buildStyleSection } from "./section-builders/style-section";
import { buildTaskSection } from "./section-builders/task-section";
import type { CompilerConfig, SectionBuilder } from "./types";
import { SECTION_PRIORITY_ORDER } from "./types";

const DEFAULT_BUILDERS: SectionBuilder[] = [
  buildTaskSection,
  buildPreservationSection,
  buildForbiddenSection,
  buildStyleSection,
  buildReferenceSection,
  buildAnalysisSection,
];

export class PromptCompiler implements PromptCompilerInterface {
  readonly version = "3.0.0";

  private readonly now: () => Date;
  private readonly hash: (contract: PromptContract) => string;
  private readonly estimateTokens: (body: string) => number;

  constructor(config: CompilerConfig = {}) {
    this.now = config.now ?? (() => new Date());
    this.hash = config.hash ?? defaultContractHash;
    this.estimateTokens = config.estimateTokens ?? estimateTokens;
  }

  compile(contract: PromptContract): CompiledPrompt {
    const sections = DEFAULT_BUILDERS
      .map((builder) => builder(contract))
      .filter((section): section is CompiledSection => Boolean(section))
      .map((section) => this.withTokenEstimate(section))
      .sort(compareSections);

    const totalTokens = sections.reduce((sum, section) => sum + section.tokens, 0);

    return {
      version: contract.version,
      compilerVersion: this.version,
      sections,
      metadata: {
        contractHash: this.hash(contract),
        compiledAt: this.now().toISOString(),
        toolId: contract.toolId,
        sectionCount: sections.length,
        totalTokens,
      },
    };
  }

  private withTokenEstimate(section: CompiledSection): CompiledSection {
    return {
      ...section,
      tokens: this.estimateTokens(section.body),
    };
  }
}

function estimateTokens(body: string): number {
  return body.length / 4;
}

function compareSections(left: CompiledSection, right: CompiledSection): number {
  const priorityDelta = SECTION_PRIORITY_ORDER[left.priority] - SECTION_PRIORITY_ORDER[right.priority];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return left.order - right.order;
}

function defaultContractHash(contract: PromptContract): string {
  const serialized = JSON.stringify(contract);
  let hash = 5381;

  for (let index = 0; index < serialized.length; index += 1) {
    hash = (hash * 33) ^ serialized.charCodeAt(index);
  }

  return `contract-${(hash >>> 0).toString(36)}`;
}
