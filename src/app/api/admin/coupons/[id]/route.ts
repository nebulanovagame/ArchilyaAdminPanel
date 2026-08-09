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

// ─── PATCH handler ──────────────────────────────────────

async function patchHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const b = body as Record<string, unknown>;

    const supabase = createAdminClient();

    // Check existence
    const { data: existing, error: fetchError } = await supabase
      .from("coupons")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: { message: "Kupon bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    // Build update payload
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const changeDescriptions: string[] = [];

    if (b.code !== undefined) {
      if (typeof b.code !== "string" || b.code.trim().length === 0) {
        return NextResponse.json(
          { error: { message: "Kupon kodu bos olamaz", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      const newCode = String(b.code).trim().toUpperCase();
      if (newCode.length > 50) {
        return NextResponse.json(
          { error: { message: "Kupon kodu maks 50 karakter olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      // Check code uniqueness (excluding current coupon)
      const { data: dup } = await supabase
        .from("coupons")
        .select("id")
        .eq("code", newCode)
        .neq("id", id)
        .single();
      if (dup) {
        return NextResponse.json(
          { error: { message: "Bu kupon kodu zaten kullaniliyor", code: "already-exists" } },
          { status: 409 },
        );
      }
      updates.code = newCode;
      changeDescriptions.push("code");
    }

    if (b.description !== undefined) {
      updates.description = typeof b.description === "string" ? b.description.slice(0, 1000) : "";
      changeDescriptions.push("description");
    }

    if (b.discountType !== undefined) {
      if (b.discountType !== "percent" && b.discountType !== "fixed") {
        return NextResponse.json(
          { error: { message: "Indirim tipi 'percent' veya 'fixed' olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.discount_type = b.discountType;
      changeDescriptions.push("discountType");
    }

    if (b.discountValue !== undefined) {
      const val = Number(b.discountValue);
      if (Number.isNaN(val) || val < 0) {
        return NextResponse.json(
          { error: { message: "Indirim degeri 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.discount_value = val;
      changeDescriptions.push("discountValue");
    }

    if (b.discountDurationMonths !== undefined) {
      const val = Number(b.discountDurationMonths);
      if (Number.isNaN(val) || val < 1 || val > 120) {
        return NextResponse.json(
          { error: { message: "Indirim suresi 1-120 ay arasinda olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.discount_duration_months = val;
      changeDescriptions.push("discountDurationMonths");
    }

    if (b.maxUses !== undefined) {
      const val = Number(b.maxUses);
      if (Number.isNaN(val) || val < -1) {
        return NextResponse.json(
          { error: { message: "Maksimum kullanim sayisi -1 veya 0'dan buyuk olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.max_uses = val;
      changeDescriptions.push("maxUses");
    }

    if (b.isActive !== undefined) {
      updates.is_active = Boolean(b.isActive);
      changeDescriptions.push("isActive");
    }

    if (b.expiresAt !== undefined) {
      updates.expires_at = typeof b.expiresAt === "string" ? b.expiresAt : null;
      changeDescriptions.push("expiresAt");
    }

    if (b.appliesToPlans !== undefined) {
      updates.applies_to_plans = Array.isArray(b.appliesToPlans) ? b.appliesToPlans : [];
      changeDescriptions.push("appliesToPlans");
    }

    if (changeDescriptions.length === 0) {
      return NextResponse.json(
        { error: { message: "Guncellenecek alan belirtilmedi", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("coupons")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Admin API /coupons/[id] PATCH error:", updateError);
      captureApiError(updateError, "admin/coupons/[id] PATCH");
      return NextResponse.json(
        { error: { message: "Kupon guncellenemedi", code: "internal" } },
        { status: 500 },
      );
    }

    // Audit log
    try {
      await writeAdminAuditLog(supabase, {
        actorId: guard.uid,
        actorEmail: guard.email,
        action: "coupon_update",
        resource: "coupon",
        resourceId: id,
        details: { changes: changeDescriptions },
      });
    } catch (auditErr) {
      console.warn("Admin API /coupons/[id] PATCH audit log error:", auditErr);
    }

    return NextResponse.json({ data: mapCoupon(updated as Record<string, unknown>) });
  } catch (err) {
    console.error("Admin API /coupons/[id] PATCH error:", err);
    captureApiError(err, "admin/coupons/[id] PATCH");
    return NextResponse.json(
      { error: { message: "Kupon guncellenemedi", code: "internal" } },
      { status: 500 },
    );
  }
}

// ─── DELETE handler (real delete — cascade redemptions) ──

async function deleteHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Check existence
    const { data: existing, error: fetchError } = await supabase
      .from("coupons")
      .select("id, code")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: { message: "Kupon bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    // Real delete (on delete cascade removes coupon_redemptions)
    const { error: deleteError } = await supabase
      .from("coupons")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Admin API /coupons/[id] DELETE error:", deleteError);
      captureApiError(deleteError, "admin/coupons/[id] DELETE");
      return NextResponse.json(
        { error: { message: "Kupon silinemedi", code: "internal" } },
        { status: 500 },
      );
    }

    // Audit log
    try {
      await writeAdminAuditLog(supabase, {
        actorId: guard.uid,
        actorEmail: guard.email,
        action: "coupon_delete",
        resource: "coupon",
        resourceId: id,
        details: { code: (existing as Record<string, unknown>).code as string },
      });
    } catch (auditErr) {
      console.warn("Admin API /coupons/[id] DELETE audit log error:", auditErr);
    }

    return NextResponse.json({ data: { success: true, id } });
  } catch (err) {
    console.error("Admin API /coupons/[id] DELETE error:", err);
    captureApiError(err, "admin/coupons/[id] DELETE");
    return NextResponse.json(
      { error: { message: "Kupon silinemedi", code: "internal" } },
      { status: 500 },
    );
  }
}

export const PATCH = withRateLimit(patchHandler, adminRateLimits.mutation);
export const DELETE = withRateLimit(deleteHandler, adminRateLimits.mutation);
