import { NextResponse } from "next/server";

import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/auth/session";
import { apiErrorResponse } from "@/lib/api/errors";
import { withRateLimit } from "@/lib/api/rate-limit";
import { validateRequestBody, idTokenSchema } from "@/lib/api/validation";
import { z } from "zod";

const sessionBodySchema = z.object({
  idToken: idTokenSchema,
});

async function handler(request: Request) {
  const validated = await validateRequestBody(sessionBodySchema, request);

  if (!validated.success) {
    return validated.errorResponse;
  }

  try {
    const sessionCookie = await createSessionCookieValue(validated.data.idToken);
    const response = NextResponse.json({ ok: true });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    });

    return response;
  } catch (error) {
    return apiErrorResponse(error, {
      authMessage: "Panel oturumu başlatılamadı. Lütfen tekrar giriş yapın.",
      defaultMessage: "Panel oturumu başlatılamadı. Lütfen tekrar deneyin.",
    });
  }
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
