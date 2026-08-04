import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";
import { captureApiError } from "@/lib/api/sentry-bridge";
import { writeAdminAuditLog } from "@/lib/api/audit";

// ─── DB → camelCase mapper ─────────────────────────────

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

function mapOfferItem(item: Record<string, unknown>) {
  return {
    serviceId: (item.serviceId as string) ?? (item.service_id as string) ?? "",
    name: (item.name as string) ?? "",
    m2: Number(item.m2) || 0,
    price: Number(item.price) || 0,
    isCustom: Boolean(item.isCustom ?? item.is_custom),
  };
}

// ─── GET handler ────────────────────────────────────────

async function getHandler(_request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("offers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Admin API /offers GET error:", error);
      captureApiError(error, "admin/offers GET");
      return NextResponse.json(
        { error: { message: "Teklifler yuklenemedi", code: "internal" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: (data ?? []).map(mapOffer) });
  } catch (err) {
    console.error("Admin API /offers GET error:", err);
    captureApiError(err, "admin/offers GET");
    return NextResponse.json(
      { error: { message: "Teklifler yuklenemedi", code: "internal" } },
      { status: 500 },
    );
  }
}

// ─── POST handler ──────────────────────────────────────

async function postHandler(request: Request) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await request.json().catch(() => ({}));
    const b = body as Record<string, unknown>;

    // Validate items
    if (!Array.isArray(b.items) || b.items.length === 0) {
      return NextResponse.json(
        { error: { message: "En az bir hizmet kalemi gereklidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const items = (b.items as Array<Record<string, unknown>>).map((item, idx) => {
      if (!item.serviceId || typeof item.serviceId !== "string") {
        throw new Error(`Kalem ${idx + 1}: serviceId gecersiz`);
      }
      if (!item.name || typeof item.name !== "string") {
        throw new Error(`Kalem ${idx + 1}: name gecersiz`);
      }
      const m2 = Number(item.m2);
      if (Number.isNaN(m2) || m2 <= 0) {
        throw new Error(`Kalem ${idx + 1}: m2 pozitif olmalidir`);
      }
      const price = Number(item.price);
      if (Number.isNaN(price) || price < 0) {
        throw new Error(`Kalem ${idx + 1}: fiyat 0 veya daha buyuk olmalidir`);
      }
      return {
        serviceId: item.serviceId,
        name: String(item.name).trim(),
        m2,
        price,
        isCustom: Boolean(item.isCustom),
      };
    });

    const subtotal = Number(b.subtotal);
    if (Number.isNaN(subtotal) || subtotal < 0) {
      return NextResponse.json(
        { error: { message: "Ara toplam 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const total = Number(b.total);
    if (Number.isNaN(total) || total < 0) {
      return NextResponse.json(
        { error: { message: "Toplam 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const supabase = createAdminClient();
    const { data: inserted, error: insertError } = await supabase
      .from("offers")
      .insert({
        id,
        admin_id: guard.uid,
        client_email: typeof b.clientEmail === "string" ? b.clientEmail.trim() : null,
        client_name: typeof b.clientName === "string" ? b.clientName.trim() : null,
        status: "draft",
        currency: typeof b.currency === "string" ? b.currency : "TRY",
        subtotal,
        kdv_percent: Number(b.kdvPercent) || 20,
        kdv_amount: Number(b.kdvAmount) || 0,
        total,
        discount_pct: Number(b.discountPct) || 0,
        discount_amount: Number(b.discountAmount) || 0,
        member_discount_on: b.memberDiscountOn !== false,
        special_prices: (b.specialPrices as Record<string, number>) ?? {},
        items,
        metadata: (b.metadata as Record<string, unknown>) ?? {},
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Admin API /offers POST insert error:", insertError);
      captureApiError(insertError, "admin/offers POST insert");
      return NextResponse.json(
        { error: { message: "Teklif kaydedilemedi", code: "internal" } },
        { status: 500 },
      );
    }

    // Audit log
    try {
      await writeAdminAuditLog(supabase, {
        actorId: guard.uid,
        actorEmail: guard.email,
        action: "offer_create",
        resource: "offer",
        resourceId: id,
        details: { itemCount: items.length, total },
      });
    } catch (auditErr) {
      console.warn("Admin API /offers POST audit log error:", auditErr);
    }

    return NextResponse.json({ data: mapOffer(inserted as Record<string, unknown>) }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Teklif kaydedilemedi";
    console.error("Admin API /offers POST error:", err);
    captureApiError(err, "admin/offers POST");
    return NextResponse.json(
      { error: { message, code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
export const POST = withRateLimit(postHandler, adminRateLimits.mutation);
