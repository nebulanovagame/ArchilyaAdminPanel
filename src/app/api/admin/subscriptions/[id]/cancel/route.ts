import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";
import { captureApiError } from "@/lib/api/sentry-bridge";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL?.replace(/\/$/, "") || "";
}

async function handler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: { message: "Admin API URL tanimli degil.", code: "config-missing" } },
      { status: 500 },
    );
  }

  const { id } = await params;
  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: { message: "Gecersiz abonelik ID.", code: "invalid-argument" } },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: { message: "Admin oturumu bulunamadi.", code: "unauthenticated" } },
        { status: 401 },
      );
    }

    const upstreamResponse = await fetch(`${apiBaseUrl}/admin/subscriptions/${id}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(15000),
    });

    const json = await upstreamResponse.json().catch(() => null);

    return NextResponse.json(
      json || { error: { message: "Backend yaniti alinamadi.", code: "upstream-error" } },
      { status: upstreamResponse.status },
    );
  } catch (err) {
    console.error("Admin API /subscriptions/[id]/cancel error:", err);
    captureApiError(err, "admin/subscriptions/[id]/cancel");
    return NextResponse.json(
      { error: { message: "Backend islemi basarisiz", code: "internal" } },
      { status: 502 },
    );
  }
}

export const POST = withRateLimit(handler, adminRateLimits.mutation);
