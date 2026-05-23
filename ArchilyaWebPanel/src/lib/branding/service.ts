import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

import type { BrandingUpdateInput } from "./types";
import { sanitizeBrandingInput } from "./validation";
import { mergeBrandingWithDefaults } from "./defaults";

export async function updateWorkspaceBranding(
  db: Firestore,
  workspaceId: string,
  input: BrandingUpdateInput,
) {
  const sanitized = sanitizeBrandingInput(input);
  const branding = mergeBrandingWithDefaults(sanitized);

  const workspaceRef = doc(db, "workspaces", workspaceId);
  await updateDoc(workspaceRef, {
    branding,
    updatedAt: serverTimestamp(),
  });
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
  storage: FirebaseStorage,
  workspaceId: string,
  file: File,
): Promise<string> {
  const safeName = sanitizeFileName(file.name);
  const path = `branding/${workspaceId}/logo/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function deleteWorkspaceLogo(
  storage: FirebaseStorage,
  workspaceId: string,
) {
  const logoRef = ref(storage, `branding/${workspaceId}/logo`);
  await deleteObject(logoRef).catch(() => undefined);
}
