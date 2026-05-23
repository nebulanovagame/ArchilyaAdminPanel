"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

import { useWorkspace } from "@/hooks/use-workspace";
import type { WorkspaceBranding } from "@/lib/branding/types";
import { DEFAULT_BRANDING, DEFAULT_CSS_VARIABLES } from "@/lib/branding/defaults";

type ThemeContextValue = {
  branding: WorkspaceBranding;
  isCustomized: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function injectCssVariables(branding: WorkspaceBranding): void {
  if (typeof window === "undefined") return;

  const root = document.documentElement;

  Object.entries(DEFAULT_CSS_VARIABLES).forEach(([key, cssVar]) => {
    const value = branding[key as keyof WorkspaceBranding];
    if (value !== undefined && value !== null) {
      root.style.setProperty(cssVar, String(value));
    }
  });
}

function isBrandingCustomized(
  branding: WorkspaceBranding,
  defaults: WorkspaceBranding,
): boolean {
  return Object.keys(defaults).some((key) => {
    const k = key as keyof WorkspaceBranding;
    return branding[k] !== defaults[k];
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { activeWorkspace } = useWorkspace();

  const branding = useMemo<WorkspaceBranding>(() => {
    return activeWorkspace?.branding ?? DEFAULT_BRANDING;
  }, [activeWorkspace?.branding]);

  const isCustomized = useMemo(() => {
    return isBrandingCustomized(branding, DEFAULT_BRANDING);
  }, [branding]);

  useEffect(() => {
    injectCssVariables(branding);
  }, [branding]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      branding,
      isCustomized,
    }),
    [branding, isCustomized],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    return {
      branding: DEFAULT_BRANDING,
      isCustomized: false,
    };
  }

  return context;
}
