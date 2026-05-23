import type { BrandingUpdateInput } from "./types";

const BRANDING_KEYS = new Set([
  "brandName",
  "tagline",
  "logoUrl",
  "faviconUrl",
  "primaryColor",
  "backgroundColor",
  "surfaceColor",
  "sidebarColor",
  "headerColor",
  "textMainColor",
  "textMutedColor",
]);

export function isValidHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

export function normalizeLogoUrl(url: string): string | null {
  const value = url.trim();

  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function sanitizeBrandingInput(input: Record<string, unknown>): BrandingUpdateInput {
  const sanitized: BrandingUpdateInput = {};

  for (const [key, value] of Object.entries(input)) {
    if (!BRANDING_KEYS.has(key)) {
      continue;
    }

    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    if (key.endsWith("Color")) {
      if (isValidHexColor(trimmed)) {
        sanitized[key as keyof BrandingUpdateInput] = trimmed;
      }
      continue;
    }

    if (key === "logoUrl" || key === "faviconUrl") {
      const normalized = normalizeLogoUrl(trimmed);
      if (normalized) {
        sanitized[key as keyof BrandingUpdateInput] = normalized;
      }
      continue;
    }

    sanitized[key as keyof BrandingUpdateInput] = trimmed;
  }

  return sanitized;
}
