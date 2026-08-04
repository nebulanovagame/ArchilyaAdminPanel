import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { captureApiError } from "@/lib/api/sentry-bridge";

// ─── DB → camelCase mapper ─────────────────────────────

function mapOfferItem(item: Record<string, unknown>) {
  return {
    serviceId: (item.serviceId as string) ?? (item.service_id as string) ?? "",
    name: (item.name as string) ?? "",
    m2: Number(item.m2) || 0,
    price: Number(item.price) || 0,
    isCustom: Boolean(item.isCustom ?? item.is_custom),
  };
}

function mapOffer(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    adminId: (row.admin_id as string) ?? "",
    clientEmail: (row.client_email as string) ?? null,
    clientName: (row.client_name as string) ?? null,
    status: (row.status as string) ?? "draft",
    currency: (row.currency as string) ?? "TRY",
    subtotal: Number(row.subtotal) || 0,
    kdvPercent: Number(row.kdv_percent) || 0,
    kdvAmount: Number(row.kdv_amount) || 0,
    total: Number(row.total) || 0,
    discountPct: Number(row.discount_pct) || 0,
    discountAmount: Number(row.discount_amount) || 0,
    memberDiscountOn: row.member_discount_on !== false,
    specialPrices: (row.special_prices as Record<string, number>) ?? {},
    items: Array.isArray(row.items) ? (row.items as Array<Record<string, unknown>>).map(mapOfferItem) : [],
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

// ─── GET handler ────────────────────────────────────────

async function getHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { message: "Teklif bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: mapOffer(data as Record<string, unknown>) });
  } catch (err) {
    console.error("Admin API /offers/[id] GET error:", err);
    captureApiError(err, "admin/offers/[id] GET");
    return NextResponse.json(
      { error: { message: "Teklif yuklenemedi", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
