import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { captureApiError } from "@/lib/api/sentry-bridge";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

    const { searchParams } = new URL(request.url);
    const page = Math.max(Number(searchParams.get("page") || DEFAULT_PAGE), 1);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") || DEFAULT_LIMIT), 1),
      MAX_LIMIT,
    );

    const upstreamParams = new URLSearchParams();
    upstreamParams.set("page", String(page));
    // Backend parsePagination reads `perPage`, not `limit`.
    upstreamParams.set("perPage", String(limit));

    const status = searchParams.get("status");
    if (status && ["pending", "completed", "failed"].includes(status)) {
      upstreamParams.set("status", status);
    }

    const upstreamResponse = await fetch(`${apiBaseUrl}/admin/payment-sessions?${upstreamParams.toString()}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const rawPayload = await upstreamResponse.json().catch(() => null);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        rawPayload || { error: { message: "Odeme oturumlari yuklenemedi.", code: "upstream-error" } },
        { status: upstreamResponse.status },
      );
    }

    // Normalize backend { data, meta } to UI { items, page, limit, total, totalPages }.
    // Backend meta: { status, days, perPage, page, total, hasMore, count } — `total`
    // is the real row count, `count` is only the current page's item count.
    const rawItems = rawPayload?.data ?? rawPayload?.items ?? [];
    const meta = rawPayload?.meta ?? {};
    const totalCount =
      typeof meta.total === "number"
        ? meta.total
        : typeof meta.count === "number"
          ? meta.count
          : Array.isArray(rawItems)
            ? rawItems.length
            : 0;
    const limitNum = typeof meta.perPage === "number" ? meta.perPage : 20;
    const currentPage = typeof meta.page === "number" ? meta.page : 1;

    // Backend items are camelCase but use `id` (= token || row id) and `planId`;
    // the UI consumes `token` and `plan` — map them here.
    const items = (Array.isArray(rawItems) ? rawItems : []).map(
      (item: Record<string, unknown>) => ({
        token: String(item.id ?? item.token ?? ""),
        userEmail: String(item.userEmail ?? ""),
        plan: String(item.planId ?? item.plan ?? ""),
        status: String(item.status ?? "pending"),
        amount: Number(item.amount) || 0,
        credits: Number(item.credits) || 0,
        createdAt: item.createdAt ? String(item.createdAt) : "",
      }),
    );

    const normalizedPayload = {
      items,
      page: currentPage,
      limit: limitNum,
      total: totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limitNum)),
    };

    return NextResponse.json(normalizedPayload);
  } catch (err) {
    console.error("Admin API /payment-sessions error:", err);
    captureApiError(err, "admin/payment-sessions");
    return NextResponse.json(
      { error: { message: "Odeme oturumlari yuklenirken hata.", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
