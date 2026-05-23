import { useEffect, useState } from "react";

import { isFeatureEnabled, type FeatureFlagName } from "@/lib/feature-flags/config";

export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  const [enabled, setEnabled] = useState<boolean>(() => isFeatureEnabled(flagName));

  useEffect(() => {
    setEnabled(isFeatureEnabled(flagName));
  }, [flagName]);

  return enabled;
}
