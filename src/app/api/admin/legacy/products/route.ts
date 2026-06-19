import "server-only";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

// Legacy data — Supabase'de legacy tablosu yok, bos dizi don
async function handler() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ data: [] });
}

export const GET = withRateLimit(handler, adminRateLimits.read);
