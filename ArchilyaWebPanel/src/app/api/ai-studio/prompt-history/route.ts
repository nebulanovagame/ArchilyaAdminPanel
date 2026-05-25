import { NextResponse } from "next/server";
import { z } from "zod";

import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { idTokenSchema, validateRequestBody } from "@/lib/api/validation";
import { getOptionalSessionUser } from "@/lib/auth/session";
import { callBackendCallableFromServer, requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";

const promptHistoryBodySchema = z.object({
  accessToken: idTokenSchema,
  action: z.enum(["get", "save"]),
  toolId: z.string().min(1).max(128).optional(),
  entry: z.record(z.string(), z.unknown()).optional(),
});

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(promptHistoryBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const { accessToken, action, toolId, entry } = validated.data;
    await requireVerifiedSupabaseIdentity(sessionUser, accessToken);

    if (action === "get") {
      const result = await callBackendCallableFromServer<Record<string, never>, { success?: boolean; history?: Record<string, unknown> }>(
        "getAiPromptHistorySecure",
        accessToken,
        {},
      );
      return NextResponse.json({ success: Boolean(result?.success), history: result?.history || {} });
    }

    if (!toolId || !entry) {
      return NextResponse.json({ error: "Prompt geçmişi kaydı için toolId ve entry zorunludur." }, { status: 400 });
    }

    const result = await callBackendCallableFromServer<{ toolId: string; entry: Record<string, unknown> }, { success?: boolean; history?: Record<string, unknown> }>(
      "saveAiPromptHistorySecure",
      accessToken,
      { toolId, entry },
    );

    return NextResponse.json({ success: Boolean(result?.success), history: result?.history || {} });
  } catch (error) {
    return apiErrorResponse(error, {
      defaultMessage: "Prompt geçmişi alınamadı.",
      backendMessage: "Prompt geçmişi servisi tamamlanamadı. Lütfen tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 30, windowMs: 60_000 });
