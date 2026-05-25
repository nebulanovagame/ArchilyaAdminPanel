import { createClient } from "@/lib/supabase/client";

import type { BrandingUpdateInput } from "./types";
import { sanitizeBrandingInput } from "./validation";
import { mergeBrandingWithDefaults } from "./defaults";

export async function updateWorkspaceBranding(
  _db: unknown,
  workspaceId: string,
  input: BrandingUpdateInput,
) {
  const sanitized = sanitizeBrandingInput(input);
  const branding = mergeBrandingWithDefaults(sanitized);

  const supabase = createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({
      branding,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);

  if (error) {
    console.warn("[branding] updateWorkspaceBranding error:", error.message);
    throw new Error("Marka ayarları güncellenemedi.");
  }
}

function sanitizeFileName(name: string): string {
  if (!name || typeof name !== "string") {
    return "file";
  }

  let sanitized = name.normalize("NFKD");
  sanitized = sanitized.replace(/[\x00-\x1f\x7f-\x9f\u200b-\u200f\u2060\ufeff]/g, "");
  sanitized = sanitized.replace(/[\\/:*?"<>|]/g, "_");
  sanitized = sanitized.replace(/\s+/g, "-");
  sanitized = sanitized.replace(/\.{2,}/g, ".");
  sanitized = sanitized.replace(/^[.-]+/, "");
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "_");
  sanitized = sanitized.replace(/[.\s]+$/, "");
  if (!sanitized) {
    return "file";
  }
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
  if (reserved.test(sanitized)) {
    sanitized = "_" + sanitized;
  }
  return sanitized;
}

export async function uploadWorkspaceLogo(
  _storage: unknown,
  workspaceId: string,
  file: File,
): Promise<string> {
  const safeName = sanitizeFileName(file.name);
  const path = `branding/${workspaceId}/logo/${Date.now()}_${safeName}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from("branding")
    .upload(path, file);

  if (error) {
    console.warn("[branding] uploadWorkspaceLogo error:", error.message);
    throw new Error("Logo yüklenemedi.");
  }

  const { data } = supabase.storage.from("branding").getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteWorkspaceLogo(
  _storage: unknown,
  workspaceId: string,
) {
  const supabase = createClient();

  // List files under the workspace logo prefix
  const { data: listData, error: listError } = await supabase.storage
    .from("branding")
    .list(`branding/${workspaceId}/logo`);

  if (listError) {
    console.warn("[branding] deleteWorkspaceLogo list error:", listError.message);
    return;
  }

  if (!listData || listData.length === 0) {
    return;
  }

  const paths = listData.map((item) => `branding/${workspaceId}/logo/${item.name}`);

  const { error } = await supabase.storage
    .from("branding")
    .remove(paths);

  if (error) {
    console.warn("[branding] deleteWorkspaceLogo remove error:", error.message);
  }
}
