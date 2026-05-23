import type { BrandingUpdateInput, WorkspaceBranding } from "./types";

export const DEFAULT_BRANDING: WorkspaceBranding = {
  brandName: "Archilya",
  tagline: "Luxury",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#c6a87c",
  backgroundColor: "#0f1115",
  surfaceColor: "#1a1c23",
  sidebarColor: "#0a0c0f",
  headerColor: "#0a0c0f",
  textMainColor: "#e2e2e2",
  textMutedColor: "#8f9299",
};

export const DEFAULT_CSS_VARIABLES: Record<string, string> = {
  brandName: "--brand-name",
  tagline: "--brand-tagline",
  logoUrl: "--brand-logo-url",
  faviconUrl: "--brand-favicon-url",
  primaryColor: "--color-primary",
  backgroundColor: "--color-background",
  surfaceColor: "--color-surface",
  sidebarColor: "--color-sidebar",
  headerColor: "--color-header",
  textMainColor: "--color-text-main",
  textMutedColor: "--color-text-muted",
};

export function mergeBrandingWithDefaults(partial: BrandingUpdateInput): WorkspaceBranding {
  return {
    ...DEFAULT_BRANDING,
    ...partial,
  };
}
