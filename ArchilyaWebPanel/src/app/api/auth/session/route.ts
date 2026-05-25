import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api/rate-limit";

async function handler() {
  // Supabase Auth manages sessions automatically via cookies.
  // This endpoint is kept for backwards compatibility with client-side session sync.
  return NextResponse.json({ ok: true });
}

export const POST = withRateLimit(handler, { limit: 10, windowMs: 60_000 });
