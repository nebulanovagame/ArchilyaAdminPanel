import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL?.replace(/\/$/, "") || "";
}

export async function GET(request: NextRequest) {
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

    const page = Math.max(Number(request.nextUrl.searchParams.get("page") || DEFAULT_PAGE), 1);
    const limit = Math.min(
      Math.max(Number(request.nextUrl.searchParams.get("limit") || DEFAULT_LIMIT), 1),
      MAX_LIMIT,
    );

    const upstreamParams = new URLSearchParams();
    upstreamParams.set("page", String(page));
    upstreamParams.set("limit", String(limit));

    const status = request.nextUrl.searchParams.get("status");
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

    const payload = await upstreamResponse.json().catch(() => null);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        payload || { error: { message: "Odeme oturumlari yuklenemedi.", code: "upstream-error" } },
        { status: upstreamResponse.status },
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Admin API /payment-sessions error:", err);
    return NextResponse.json(
      { error: { message: "Odeme oturumlari yuklenirken hata.", code: "internal" } },
      { status: 500 },
    );
  }
}
