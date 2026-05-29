import type { CompiledPrompt, PromptContract, PromptLog, ProviderPrompt } from "../types";
import type { LoggerOptions } from "./types";

const DEFAULT_MAX_ENTRIES = 50;
const DEFAULT_STORAGE: Required<LoggerOptions>["storage"] = "memory";
const LOCAL_STORAGE_PREFIX = "archilya:prompt-log:";

export class PromptLogger {
  private readonly storage: Required<LoggerOptions>["storage"];
  private readonly maxEntries: number;
  private readonly logs: PromptLog[] = [];
  private readonly localStorageKeys = new Set<string>();

  constructor(options: LoggerOptions = {}) {
    this.storage = options.storage ?? DEFAULT_STORAGE;
    this.maxEntries = normalizeMaxEntries(options.maxEntries);
  }

  log(
    jobId: string,
    contract: PromptContract,
    compiled: CompiledPrompt,
    providerPrompt: ProviderPrompt,
  ): PromptLog {
    const entry: PromptLog = {
      jobId,
      promptVersion: providerPrompt.promptVersion,
      compilerVersion: compiled.compilerVersion,
      contractHash: compiled.metadata.contractHash,
      contractSnapshot: cloneSnapshot(contract),
      compiledSections: cloneSnapshot(compiled.sections),
      providerAdapter: providerPrompt.provider,
      finalPrompt: cloneSnapshot(providerPrompt),
      timestamp: new Date().toISOString(),
    };

    this.logs.push(entry);
    this.trimMemoryBuffer();
    this.storeInLocalStorage(entry);

    return entry;
  }

  getLog(jobId: string): PromptLog | null {
    const memoryEntry = findLatestByJobId(this.logs, jobId);
    if (memoryEntry) {
      return memoryEntry;
    }

    return this.readFromLocalStorage(jobId);
  }

  getRecentLogs(count?: number): PromptLog[] {
    const limit = count === undefined ? this.logs.length : Math.max(0, Math.floor(count));
    if (limit === 0) {
      return [];
    }

    return this.logs.slice(-limit);
  }

  getStats(): {
    totalLogs: number;
    byTool: Record<string, number>;
    byProvider: Record<string, number>;
    avgSectionCount: number;
    avgTokens: number;
  } {
    const totals = this.logs.reduce(
      (stats, log) => {
        const toolId = log.contractSnapshot.toolId;
        const provider = log.providerAdapter;
        const sectionCount = log.compiledSections.length;
        const tokenCount = log.compiledSections.reduce((sum, section) => sum + section.tokens, 0);

        stats.byTool[toolId] = (stats.byTool[toolId] ?? 0) + 1;
        stats.byProvider[provider] = (stats.byProvider[provider] ?? 0) + 1;
        stats.sectionCount += sectionCount;
        stats.tokens += tokenCount;

        return stats;
      },
      {
        byTool: {} as Record<string, number>,
        byProvider: {} as Record<string, number>,
        sectionCount: 0,
        tokens: 0,
      },
    );

    const totalLogs = this.logs.length;

    return {
      totalLogs,
      byTool: totals.byTool,
      byProvider: totals.byProvider,
      avgSectionCount: totalLogs === 0 ? 0 : totals.sectionCount / totalLogs,
      avgTokens: totalLogs === 0 ? 0 : totals.tokens / totalLogs,
    };
  }

  clear(): void {
    this.logs.length = 0;
    this.clearLocalStorageEntries();
  }

  private trimMemoryBuffer(): void {
    if (this.logs.length <= this.maxEntries) {
      return;
    }

    this.logs.splice(0, this.logs.length - this.maxEntries);
  }

  private storeInLocalStorage(entry: PromptLog): void {
    if (this.storage !== "localStorage") {
      return;
    }

    const localStorage = getLocalStorage();
    if (!localStorage) {
      return;
    }

    const key = getLocalStorageKey(entry.jobId);
    localStorage.setItem(key, JSON.stringify(entry));
    this.localStorageKeys.add(key);
  }

  private readFromLocalStorage(jobId: string): PromptLog | null {
    if (this.storage !== "localStorage") {
      return null;
    }

    const localStorage = getLocalStorage();
    if (!localStorage) {
      return null;
    }

    const rawEntry = localStorage.getItem(getLocalStorageKey(jobId));
    if (!rawEntry) {
      return null;
    }

    try {
      return JSON.parse(rawEntry) as PromptLog;
    } catch {
      return null;
    }
  }

  private clearLocalStorageEntries(): void {
    if (this.storage !== "localStorage") {
      this.localStorageKeys.clear();
      return;
    }

    const localStorage = getLocalStorage();
    if (!localStorage) {
      this.localStorageKeys.clear();
      return;
    }

    for (const key of this.localStorageKeys) {
      localStorage.removeItem(key);
    }

    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(LOCAL_STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }

    this.localStorageKeys.clear();
  }
}

function normalizeMaxEntries(maxEntries: number | undefined): number {
  if (maxEntries === undefined || !Number.isFinite(maxEntries)) {
    return DEFAULT_MAX_ENTRIES;
  }

  return Math.max(1, Math.floor(maxEntries));
}

function findLatestByJobId(logs: PromptLog[], jobId: string): PromptLog | null {
  for (let index = logs.length - 1; index >= 0; index -= 1) {
    if (logs[index].jobId === jobId) {
      return logs[index];
    }
  }

  return null;
}

function getLocalStorageKey(jobId: string): string {
  return `${LOCAL_STORAGE_PREFIX}${jobId}`;
}

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
