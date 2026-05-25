import { describe, expect, it } from "vitest";

import { brandingUploadLogoFormSchema } from "@/lib/api/validation";

const validFormData = {
  accessToken: "valid-token-123",
  workspaceId: "workspace-1",
};

function createLogoFile(name: string, type: string, size = 16): File {
  return new File([new Uint8Array(size)], name, { type });
}

describe("brandingUploadLogoFormSchema", () => {
  it("accepts allowed logo file types", () => {
    const logo = createLogoFile("logo.webp", "image/webp");

    const result = brandingUploadLogoFormSchema.safeParse({ ...validFormData, logo });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported MIME types", () => {
    const logo = createLogoFile("logo.png", "application/pdf");

    const result = brandingUploadLogoFormSchema.safeParse({ ...validFormData, logo });

    expect(result.success).toBe(false);
  });

  it("rejects files larger than 2MB", () => {
    const logo = createLogoFile("logo.png", "image/png", 2 * 1024 * 1024 + 1);

    const result = brandingUploadLogoFormSchema.safeParse({ ...validFormData, logo });

    expect(result.success).toBe(false);
  });

  it("rejects unsupported file extensions", () => {
    const logo = createLogoFile("logo.gif", "image/png");

    const result = brandingUploadLogoFormSchema.safeParse({ ...validFormData, logo });

    expect(result.success).toBe(false);
  });
});
