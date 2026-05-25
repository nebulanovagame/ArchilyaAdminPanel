import { NextResponse } from "next/server";

import { getOptionalSessionUser } from "@/lib/auth/session";
import { callBackendCallableFromServer, requireVerifiedSupabaseIdentity } from "@/lib/supabase/callable";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { z } from "zod";
import { validateRequestBody } from "@/lib/api/validation";

const feedbackSchema = z.object({
  accessToken: z.string().min(10).max(8192),
  jobId: z.string().min(1).max(200),
  feedback: z.enum(["positive", "negative"]),
});

async function handler(request: Request) {
  const sessionUser = await getOptionalSessionUser();
  const validated = await validateRequestBody(feedbackSchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const body = validated.data;

    await requireVerifiedSupabaseIdentity(sessionUser, body.accessToken);

    const result = await callBackendCallableFromServer("updateAiJobFeedbackSecure", body.accessToken, {
      jobId: body.jobId,
      feedback: body.feedback,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return apiErrorResponse(error, {
      defaultMessage: "Geri bildirim kaydedilemedi.",
      backendMessage: "Geri bildirim kaydedilemedi. Lütfen tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
