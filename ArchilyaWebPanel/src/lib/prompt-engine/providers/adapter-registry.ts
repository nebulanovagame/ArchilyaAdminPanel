import type { ProviderAdapter, ProviderName } from "./types";
import { FluxAdapter } from "./flux-adapter";
import { GeminiAdapter } from "./gemini-adapter";

const ADAPTERS: Partial<Record<ProviderName, ProviderAdapter>> = {
  gemini: new GeminiAdapter(),
  flux: new FluxAdapter(),
};

export function getProviderAdapter(provider: ProviderName): ProviderAdapter {
  const adapter = ADAPTERS[provider];

  if (!adapter) {
    throw new Error(`Unsupported prompt provider: ${provider}`);
  }

  return adapter;
}

export function getAvailableProviders(): ProviderName[] {
  return Object.keys(ADAPTERS) as ProviderName[];
}
