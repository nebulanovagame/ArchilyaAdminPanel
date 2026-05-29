export type FeatureFlagName = "batchAiGeneration" | "newDashboardLayout" | "experimentalTool" | "promptEngineV3";

export const FEATURE_FLAGS: Record<FeatureFlagName, boolean> = {
  batchAiGeneration: false,
  newDashboardLayout: false,
  experimentalTool: false,
  promptEngineV3: false,
};

export function isFeatureEnabled(flagName: FeatureFlagName): boolean {
  const defaultValue = FEATURE_FLAGS[flagName];

  if (typeof window === "undefined") {
    return defaultValue;
  }

  const storedValue = window.localStorage.getItem(`archilya-flags-${flagName}`);

  if (storedValue === "true") {
    return true;
  }

  if (storedValue === "false") {
    return false;
  }

  return defaultValue;
}
