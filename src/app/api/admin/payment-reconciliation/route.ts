import "server-only";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin-guard";

export const dynamic = "force-dynamic";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL?.replace(/\/$/, "") || "";
}

export async function GET() {
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

    const upstreamResponse = await fetch(`${apiBaseUrl}/admin/payment-reconciliation`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    const payload = await upstreamResponse.json().catch(() => null);

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        payload || { error: { message: "Odeme mutabakat verisi yuklenemedi.", code: "upstream-error" } },
        { status: upstreamResponse.status },
      );
    }

    return NextResponse.json(payload);
  } catch (err) {
    console.error("Admin API /payment-reconciliation error:", err);
    return NextResponse.json(
      { error: { message: "Odeme mutabakat verisi yuklenirken hata.", code: "internal" } },
      { status: 500 },
    );
  }
}
