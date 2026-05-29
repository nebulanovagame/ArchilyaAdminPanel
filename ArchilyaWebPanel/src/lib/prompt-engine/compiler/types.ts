import type {
  CompiledSection,
  PromptCompiler,
  PromptContract,
  SectionPriority,
} from "../types";

export type {
  CompiledPrompt,
  CompiledPromptMetadata,
  CompiledSection,
  PromptCompiler,
  PromptContract,
  SectionPriority,
} from "../types";

export type SectionBuilder = (contract: PromptContract) => CompiledSection | undefined;

export interface CompilerConfig {
  now?: () => Date;
  hash?: (contract: PromptContract) => string;
  estimateTokens?: (body: string) => number;
}

export const SECTION_PRIORITY_ORDER: Record<SectionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

export type PromptCompilerInterface = PromptCompiler;
