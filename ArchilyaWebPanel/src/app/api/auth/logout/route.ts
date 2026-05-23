import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { withRateLimit } from "@/lib/api/rate-limit";

async function handler() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export const POST = withRateLimit(handler, { limit: 20, windowMs: 60_000 });
