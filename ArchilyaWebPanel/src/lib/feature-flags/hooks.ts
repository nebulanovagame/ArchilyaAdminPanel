import { isFeatureEnabled, type FeatureFlagName } from "@/lib/feature-flags/config";

export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  return isFeatureEnabled(flagName);
}
