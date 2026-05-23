import { afterEach, describe, expect, it, vi } from "vitest";

import { FEATURE_FLAGS, isFeatureEnabled, type FeatureFlagName } from "@/lib/feature-flags/config";

type StorageMap = Map<string, string>;

function createWindowWithStorage(initialValues?: Record<string, string>) {
  const storage = new Map(Object.entries(initialValues ?? {}));

  return {
    localStorage: {
      getItem(key: string) {
        return storage.has(key) ? storage.get(key) ?? null : null;
      },
      setItem(key: string, value: string) {
        storage.set(key, value);
      },
      removeItem(key: string) {
        storage.delete(key);
      },
      clear() {
        storage.clear();
      },
    },
  };
}

function getStorageKey(flagName: FeatureFlagName) {
  return `archilya-flags-${flagName}`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isFeatureEnabled", () => {
  it("returns the default values when no override exists", () => {
    vi.stubGlobal("window", createWindowWithStorage());

    expect(FEATURE_FLAGS.batchAiGeneration).toBe(false);
    expect(FEATURE_FLAGS.newDashboardLayout).toBe(false);
    expect(FEATURE_FLAGS.experimentalTool).toBe(false);
    expect(isFeatureEnabled("batchAiGeneration")).toBe(false);
    expect(isFeatureEnabled("newDashboardLayout")).toBe(false);
    expect(isFeatureEnabled("experimentalTool")).toBe(false);
  });

  it("enables a flag when localStorage stores true", () => {
    vi.stubGlobal("window", createWindowWithStorage({
      [getStorageKey("batchAiGeneration")]: "true",
    }));

    expect(isFeatureEnabled("batchAiGeneration")).toBe(true);
  });

  it("disables a flag when localStorage stores false", () => {
    vi.stubGlobal("window", createWindowWithStorage({
      [getStorageKey("batchAiGeneration")]: "false",
    }));

    expect(isFeatureEnabled("batchAiGeneration")).toBe(false);
  });

  it("falls back to the default when localStorage stores an unknown value", () => {
    vi.stubGlobal("window", createWindowWithStorage({
      [getStorageKey("batchAiGeneration")]: "maybe",
    }));

    expect(isFeatureEnabled("batchAiGeneration")).toBe(FEATURE_FLAGS.batchAiGeneration);
  });

  it("is SSR-safe and returns defaults when window is unavailable", () => {
    vi.unstubAllGlobals();

    expect(isFeatureEnabled("batchAiGeneration")).toBe(FEATURE_FLAGS.batchAiGeneration);
    expect(isFeatureEnabled("newDashboardLayout")).toBe(FEATURE_FLAGS.newDashboardLayout);
    expect(isFeatureEnabled("experimentalTool")).toBe(FEATURE_FLAGS.experimentalTool);
  });
});
