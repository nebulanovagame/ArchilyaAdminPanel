import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { captureApiError } from "@/lib/api/sentry-bridge";

export const dynamic = "force-dynamic";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL?.replace(/\/$/, "") || "";
}

async function handler(request: Request) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) {
    return NextResponse.json(
      { error: { message: "Admin API URL tanimli degil.", code: "config-missing" } },
      { status: 500 },
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

    // Forward the same query params the backend admin router understands
    // (days/page/perPage). Without this the backend always used its defaults
    // (days=1, page=1, perPage=50) — the panel could never reconcile beyond
    // the last 24 hours.
    const { searchParams } = new URL(request.url);
    const upstreamParams = new URLSearchParams();
    const days = searchParams.get("days");
    const page = searchParams.get("page");
    const perPage = searchParams.get("perPage") ?? searchParams.get("limit");
    if (days) upstreamParams.set("days", days);
    if (page) upstreamParams.set("page", page);
    if (perPage) upstreamParams.set("perPage", perPage);
    const query = upstreamParams.toString();

    const upstreamResponse = await fetch(
      `${apiBaseUrl}/admin/payment-reconciliation${query ? `?${query}` : ""}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );

    const rawPayload = await upstreamResponse.json().catch(() => null);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        rawPayload || { error: { message: "Odeme mutabakat verisi yuklenemedi.", code: "upstream-error" } },
        { status: upstreamResponse.status },
      );
    }

    // Normalize backend { data, meta, pagination } to UI { items, total }.
    // NOTE: the backend provides no global count — `total` is the number of
    // issues in the returned page slice (bounded by perPage).
    const items = rawPayload?.data ?? rawPayload?.items ?? [];
    const normalizedPayload = {
      items: Array.isArray(items) ? items : [],
      total: Array.isArray(items) ? items.length : 0,
    };

    return NextResponse.json(normalizedPayload);
  } catch (err) {
    console.error("Admin API /payment-reconciliation error:", err);
    captureApiError(err, "admin/payment-reconciliation");
    return NextResponse.json(
      { error: { message: "Odeme mutabakat verisi yuklenirken hata.", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
