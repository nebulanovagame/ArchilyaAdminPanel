export type WorkspaceBranding = {
  brandName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  sidebarColor: string;
  headerColor: string;
  textMainColor: string;
  textMutedColor: string;
};

export type ThemeConfig = {
  cssVariables: Record<string, string>;
  logoVariant: "image" | "text";
};

export type BrandingUpdateInput = Partial<WorkspaceBranding>;
