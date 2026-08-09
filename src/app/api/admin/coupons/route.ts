import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";
import { captureApiError } from "@/lib/api/sentry-bridge";
import { writeAdminAuditLog } from "@/lib/api/audit";

// ─── DB → camelCase mapper ─────────────────────────────

function mapCoupon(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    code: row.code as string,
    description: (row.description as string) ?? "",
    discountType: (row.discount_type as "percent" | "fixed") ?? "percent",
    discountValue: Number(row.discount_value) || 0,
    discountDurationMonths: Number(row.discount_duration_months) || 12,
    maxUses: Number(row.max_uses) ?? -1,
    usedCount: Number(row.used_count) || 0,
    isActive: row.is_active !== false,
    expiresAt: (row.expires_at as string) ?? null,
    appliesToPlans: Array.isArray(row.applies_to_plans) ? (row.applies_to_plans as string[]) : [],
    createdBy: (row.created_by as string) ?? null,
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

// ─── GET handler ────────────────────────────────────────

async function getHandler(_request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin API /coupons GET error:", error);
      captureApiError(error, "admin/coupons GET");
      return NextResponse.json(
        { error: { message: "Kuponlar yuklenemedi", code: "internal" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: (data ?? []).map(mapCoupon) });
  } catch (err) {
    console.error("Admin API /coupons GET error:", err);
    captureApiError(err, "admin/coupons GET");
    return NextResponse.json(
      { error: { message: "Kuponlar yuklenemedi", code: "internal" } },
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

    // Validate required fields
    if (!b.code || typeof b.code !== "string" || b.code.trim().length === 0) {
      return NextResponse.json(
        { error: { message: "Kupon kodu zorunludur", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const code = String(b.code).trim().toUpperCase();
    if (code.length > 50) {
      return NextResponse.json(
        { error: { message: "Kupon kodu maks 50 karakter olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    if (b.discountType !== "percent" && b.discountType !== "fixed") {
      return NextResponse.json(
        { error: { message: "Indirim tipi 'percent' veya 'fixed' olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const discountValue = Number(b.discountValue);
    if (Number.isNaN(discountValue) || discountValue < 0) {
      return NextResponse.json(
        { error: { message: "Indirim degeri 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    if (b.discountType === "percent" && discountValue > 100) {
      return NextResponse.json(
        { error: { message: "Yuzde indirim 100'den buyuk olamaz", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const discountDurationMonths = Number(b.discountDurationMonths) || 12;
    if (discountDurationMonths < 1 || discountDurationMonths > 120) {
      return NextResponse.json(
        { error: { message: "Indirim suresi 1-120 ay arasinda olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const maxUses = b.maxUses != null ? Number(b.maxUses) : -1;
    if (Number.isNaN(maxUses) || maxUses < -1) {
      return NextResponse.json(
        { error: { message: "Maksimum kullanim sayisi -1 (sinirsiz) veya 0'dan buyuk olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    // Check code uniqueness
    const supabase = createAdminClient();
    const { data: existingCoupon } = await supabase
      .from("coupons")
      .select("id")
      .eq("code", code)
      .single();

    if (existingCoupon) {
      return NextResponse.json(
        { error: { message: "Bu kupon kodu zaten kullaniliyor", code: "already-exists" } },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const { data: inserted, error: insertError } = await supabase
      .from("coupons")
      .insert({
        id,
        code,
        description: typeof b.description === "string" ? b.description.slice(0, 1000) : "",
        discount_type: b.discountType,
        discount_value: discountValue,
        discount_duration_months: discountDurationMonths,
        max_uses: maxUses,
        used_count: 0,
        is_active: b.isActive !== false,
        expires_at: typeof b.expiresAt === "string" ? b.expiresAt : null,
        applies_to_plans: Array.isArray(b.appliesToPlans) ? b.appliesToPlans : [],
        created_by: guard.uid,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Admin API /coupons POST insert error:", insertError);
      captureApiError(insertError, "admin/coupons POST insert");
      return NextResponse.json(
        { error: { message: "Kupon eklenemedi", code: "internal" } },
        { status: 500 },
      );
    }

    // Audit log
    try {
      await writeAdminAuditLog(supabase, {
        actorId: guard.uid,
        actorEmail: guard.email,
        action: "coupon_create",
        resource: "coupon",
        resourceId: id,
        details: { code, discountType: b.discountType, discountValue },
      });
    } catch (auditErr) {
      console.warn("Admin API /coupons POST audit log error:", auditErr);
    }

    return NextResponse.json({ data: mapCoupon(inserted as Record<string, unknown>) }, { status: 201 });
  } catch (err) {
    console.error("Admin API /coupons POST error:", err);
    captureApiError(err, "admin/coupons POST");
    return NextResponse.json(
      { error: { message: "Kupon eklenemedi", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
export const POST = withRateLimit(postHandler, adminRateLimits.mutation);
