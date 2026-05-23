"use client";

import type { ReactNode } from "react";

import { useFeatureFlag } from "@/lib/feature-flags/hooks";
import type { FeatureFlagName } from "@/lib/feature-flags/config";

type FeatureGateProps = {
  flagName: FeatureFlagName;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function FeatureGate({
  flagName,
  children,
  fallback = null,
}: FeatureGateProps) {
  const enabled = useFeatureFlag(flagName);

  if (!enabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
