export type { PromptLog } from "../types";

export interface LoggerOptions {
  storage?: "memory" | "localStorage" | "supabase";
  maxEntries?: number;
}
