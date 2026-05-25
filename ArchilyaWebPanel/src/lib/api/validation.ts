import { NextResponse } from "next/server";
import { z } from "zod";

export const accessTokenSchema = z.string().min(10).max(8192);
/**
 * @deprecated Use accessTokenSchema instead.
 * TODO: Remove after all API consumers send `accessToken` field instead of `idToken`.
 */
export const idTokenSchema = accessTokenSchema;

export const positiveIntegerSchema = z.number().int().min(1).max(1_000_000_000);

export const idempotencyKeySchema = z.string().min(8).max(128).regex(/^[A-Za-z0-9_-]+$/);

export const creditMutationBodySchema = z.object({
  accessToken: accessTokenSchema,
  workspaceId: z.string().min(1).max(128),
  amount: positiveIntegerSchema,
  idempotencyKey: idempotencyKeySchema,
  description: z.string().max(500).optional(),
});

export const workspaceCreditMutationBodySchema = z.object({
  accessToken: accessTokenSchema,
  workspaceId: z.string().min(1).max(128),
  amount: positiveIntegerSchema,
  idempotencyKey: idempotencyKeySchema,
  description: z.string().max(500).optional(),
});

export const subscriptionQuoteBodySchema = z.object({
  accessToken: accessTokenSchema,
  workspaceId: z.string().min(1).max(128),
  targetPlanId: z.string().min(1).max(128),
});

export const subscriptionChangeBodySchema = z.object({
  accessToken: accessTokenSchema,
  workspaceId: z.string().min(1).max(128),
  targetPlanId: z.string().min(1).max(128),
  quoteId: z.string().max(128).optional(),
});

export const subscriptionCancelBodySchema = z.object({
  accessToken: accessTokenSchema,
  workspaceId: z.string().min(1).max(128),
});

export const subscriptionReactivateBodySchema = z.object({
  accessToken: accessTokenSchema,
  workspaceId: z.string().min(1).max(128),
});

export const aiStudioJobBodySchema = z.object({
  accessToken: accessTokenSchema,
  toolId: z.string().min(1).max(128),
  imagePart: z.record(z.string(), z.unknown()).optional(),
  style: z.string().max(128).optional(),
  sceneEditMode: z.string().max(128).optional(),
  extraNote: z.string().max(5000).optional(),
  generationVariant: z.string().max(128).optional(),
  imageUrls: z.array(z.string().max(2048)).optional(),
  referenceImages: z.array(z.unknown()).optional(),
});

export const brandingUpdateBodySchema = z.object({
  accessToken: accessTokenSchema,
  workspaceId: z.string().min(1).max(128),
  branding: z.record(z.string(), z.string()).optional(),
});

const MAX_LOGO_FILE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/svg+xml", "image/webp"]);
const ALLOWED_LOGO_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp"]);

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

const logoFileSchema = z
  .instanceof(File)
  .refine((file) => file.size > 0, "Logo dosyası gereklidir.")
  .refine(
    (file) => file.size <= MAX_LOGO_FILE_SIZE_BYTES,
    "Logo dosyası en fazla 2MB olabilir.",
  )
  .refine(
    (file) => ALLOWED_LOGO_MIME_TYPES.has(file.type),
    "Logo dosyası PNG, JPG, SVG veya WEBP formatında olmalıdır.",
  )
  .refine(
    (file) => ALLOWED_LOGO_EXTENSIONS.has(getFileExtension(file.name)),
    "Logo dosya uzantısı .png, .jpg, .jpeg, .svg veya .webp olmalıdır.",
  );

export const brandingUploadLogoFormSchema = z.object({
  accessToken: z.preprocess((value) => (typeof value === "string" ? value.trim() : value), accessTokenSchema),
  workspaceId: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1).max(128),
  ),
  logo: logoFileSchema,
});

export async function validateRequestBody<T extends z.ZodType>(
  schema: T,
  request: Request,
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; errorResponse: NextResponse<{ error: string }> }
> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      errorResponse: NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return {
      success: false,
      errorResponse: NextResponse.json({ error: `Doğrulama hatası: ${message}` }, { status: 400 }),
    };
  }

  return { success: true, data: parsed.data as z.infer<T> };
}

export async function validateFormData<T extends z.ZodType>(
  schema: T,
  request: Request,
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; errorResponse: NextResponse<{ error: string }> }
> {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return {
      success: false,
      errorResponse: NextResponse.json({ error: "Geçersiz form verisi." }, { status: 400 }),
    };
  }

  const entries: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    entries[key] = value;
  });

  const parsed = schema.safeParse(entries);

  if (!parsed.success) {
    const message = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return {
      success: false,
      errorResponse: NextResponse.json({ error: `Doğrulama hatası: ${message}` }, { status: 400 }),
    };
  }

  return { success: true, data: parsed.data as z.infer<T> };
}
