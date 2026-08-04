import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";
import { captureApiError } from "@/lib/api/sentry-bridge";
import { writeAdminAuditLog } from "@/lib/api/audit";

// ─── DB → camelCase mapper ─────────────────────────────

function mapService(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    basePrice: Number(row.base_price) || 0,
    perM2: row.per_m2 != null ? Number(row.per_m2) : null,
    minPrice: row.min_price != null ? Number(row.min_price) : null,
    category: (row.category as "arch" | "vr") ?? "arch",
    group: (row.group as string) ?? "",
    defaultM2: Number(row.default_m2) || 100,
    guarantee: Boolean(row.guarantee),
    badge: (row.badge as string) ?? null,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    isActive: row.is_active !== false,
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
      .from("offer_services")
      .select("id")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: { message: "Hizmet bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    // Build update payload
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const changeDescriptions: string[] = [];

    if (b.name !== undefined) {
      if (typeof b.name !== "string" || b.name.length > 200 || b.name.length === 0) {
        return NextResponse.json(
          { error: { message: "Hizmet adi gecersiz (maks 200 karakter)", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.name = b.name.trim();
      changeDescriptions.push("name");
    }

    if (b.description !== undefined) {
      updates.description = typeof b.description === "string" ? b.description.slice(0, 2000) : "";
      changeDescriptions.push("description");
    }

    if (b.basePrice !== undefined) {
      const val = Number(b.basePrice);
      if (Number.isNaN(val) || val < 0) {
        return NextResponse.json(
          { error: { message: "Taban fiyat 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.base_price = val;
      changeDescriptions.push("basePrice");
    }

    if (b.perM2 !== undefined) {
      const val = b.perM2 != null ? Number(b.perM2) : null;
      if (val !== null && (Number.isNaN(val) || val < 0)) {
        return NextResponse.json(
          { error: { message: "m2 fiyati 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.per_m2 = val;
      changeDescriptions.push("perM2");
    }

    if (b.minPrice !== undefined) {
      const val = b.minPrice != null ? Number(b.minPrice) : null;
      if (val !== null && (Number.isNaN(val) || val < 0)) {
        return NextResponse.json(
          { error: { message: "Minimum fiyat 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.min_price = val;
      changeDescriptions.push("minPrice");
    }

    if (b.category !== undefined) {
      if (b.category !== "arch" && b.category !== "vr") {
        return NextResponse.json(
          { error: { message: "Kategori 'arch' veya 'vr' olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.category = b.category;
      changeDescriptions.push("category");
    }

    if (b.group !== undefined) {
      if (typeof b.group !== "string" || b.group.length > 50 || b.group.length === 0) {
        return NextResponse.json(
          { error: { message: "Grup gecersiz (maks 50 karakter)", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.group = b.group.trim();
      changeDescriptions.push("group");
    }

    if (b.defaultM2 !== undefined) {
      const val = Number(b.defaultM2);
      if (Number.isNaN(val) || val < 1 || val > 10000) {
        return NextResponse.json(
          { error: { message: "Varsayilan m2 1-10000 arasinda olmalidir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      updates.default_m2 = val;
      changeDescriptions.push("defaultM2");
    }

    if (b.guarantee !== undefined) {
      updates.guarantee = Boolean(b.guarantee);
      changeDescriptions.push("guarantee");
    }

    if (b.badge !== undefined) {
      updates.badge = b.badge != null ? String(b.badge).slice(0, 100) : null;
      changeDescriptions.push("badge");
    }

    if (b.features !== undefined) {
      const features = Array.isArray(b.features) ? b.features : [];
      if (features.length > 20) {
        return NextResponse.json(
          { error: { message: "En fazla 20 ozellik eklenebilir", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      for (const f of features) {
        if (typeof f !== "string" || f.length > 200) {
          return NextResponse.json(
            { error: { message: "Ozellik metni maks 200 karakter olmalidir", code: "invalid-argument" } },
            { status: 400 },
          );
        }
      }
      updates.features = features;
      changeDescriptions.push("features");
    }

    if (b.isActive !== undefined) {
      updates.is_active = Boolean(b.isActive);
      changeDescriptions.push("isActive");
    }

    if (changeDescriptions.length === 0) {
      return NextResponse.json(
        { error: { message: "Guncellenecek alan belirtilmedi", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("offer_services")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Admin API /offer-services/[id] PATCH error:", updateError);
      captureApiError(updateError, "admin/offer-services/[id] PATCH");
      return NextResponse.json(
        { error: { message: "Hizmet guncellenemedi", code: "internal" } },
        { status: 500 },
      );
    }

    // Audit log
    try {
      await writeAdminAuditLog(supabase, {
        actorId: guard.uid,
        actorEmail: guard.email,
        action: "offer_service_update",
        resource: "offer_service",
        resourceId: id,
        details: { changes: changeDescriptions },
      });
    } catch (auditErr) {
      console.warn("Admin API /offer-services/[id] PATCH audit log error:", auditErr);
    }

    return NextResponse.json({ data: mapService(updated as Record<string, unknown>) });
  } catch (err) {
    console.error("Admin API /offer-services/[id] PATCH error:", err);
    captureApiError(err, "admin/offer-services/[id] PATCH");
    return NextResponse.json(
      { error: { message: "Hizmet guncellenemedi", code: "internal" } },
      { status: 500 },
    );
  }
}

// ─── DELETE handler (soft delete → is_active = false) ──

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
      .from("offer_services")
      .select("id, name")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: { message: "Hizmet bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    // Soft delete
    const { error: updateError } = await supabase
      .from("offer_services")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) {
      console.error("Admin API /offer-services/[id] DELETE error:", updateError);
      captureApiError(updateError, "admin/offer-services/[id] DELETE");
      return NextResponse.json(
        { error: { message: "Hizmet silinemedi", code: "internal" } },
        { status: 500 },
      );
    }

    // Audit log
    try {
      await writeAdminAuditLog(supabase, {
        actorId: guard.uid,
        actorEmail: guard.email,
        action: "offer_service_delete",
        resource: "offer_service",
        resourceId: id,
        details: { name: (existing as Record<string, unknown>).name as string },
      });
    } catch (auditErr) {
      console.warn("Admin API /offer-services/[id] DELETE audit log error:", auditErr);
    }

    return NextResponse.json({ data: { success: true, id } });
  } catch (err) {
    console.error("Admin API /offer-services/[id] DELETE error:", err);
    captureApiError(err, "admin/offer-services/[id] DELETE");
    return NextResponse.json(
      { error: { message: "Hizmet silinemedi", code: "internal" } },
      { status: 500 },
    );
  }
}

export const PATCH = withRateLimit(patchHandler, adminRateLimits.mutation);
export const DELETE = withRateLimit(deleteHandler, adminRateLimits.mutation);
