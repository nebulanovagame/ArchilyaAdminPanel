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

// ─── GET handler ────────────────────────────────────────

async function getHandler(_request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("offer_services")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin API /offer-services GET error:", error);
      captureApiError(error, "admin/offer-services GET");
      return NextResponse.json(
        { error: { message: "Hizmetler yuklenemedi", code: "internal" } },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: (data ?? []).map(mapService) });
  } catch (err) {
    console.error("Admin API /offer-services GET error:", err);
    captureApiError(err, "admin/offer-services GET");
    return NextResponse.json(
      { error: { message: "Hizmetler yuklenemedi", code: "internal" } },
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
    if (!b.name || typeof b.name !== "string" || b.name.length > 200) {
      return NextResponse.json(
        { error: { message: "Hizmet adi zorunludur (maks 200 karakter)", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const basePrice = Number(b.basePrice);
    if (Number.isNaN(basePrice) || basePrice < 0) {
      return NextResponse.json(
        { error: { message: "Taban fiyat 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const category = b.category;
    if (category !== undefined && category !== "arch" && category !== "vr") {
      return NextResponse.json(
        { error: { message: "Kategori 'arch' veya 'vr' olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    if (!b.group || typeof b.group !== "string" || b.group.length > 50) {
      return NextResponse.json(
        { error: { message: "Grup zorunludur (maks 50 karakter)", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const defaultM2 = Number(b.defaultM2);
    if (Number.isNaN(defaultM2) || defaultM2 < 1 || defaultM2 > 10000) {
      return NextResponse.json(
        { error: { message: "Varsayilan m2 1-10000 arasinda olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    // Validate optional numeric fields
    const perM2 = b.perM2 != null ? Number(b.perM2) : null;
    if (perM2 !== null && (Number.isNaN(perM2) || perM2 < 0)) {
      return NextResponse.json(
        { error: { message: "m2 fiyati 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const minPrice = b.minPrice != null ? Number(b.minPrice) : null;
    if (minPrice !== null && (Number.isNaN(minPrice) || minPrice < 0)) {
      return NextResponse.json(
        { error: { message: "Minimum fiyat 0 veya daha buyuk olmalidir", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    // Validate features
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

    const badge = b.badge != null ? String(b.badge).slice(0, 100) : null;

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const supabase = createAdminClient();
    const { data: inserted, error: insertError } = await supabase
      .from("offer_services")
      .insert({
        id,
        name: String(b.name).trim(),
        description: typeof b.description === "string" ? b.description.slice(0, 2000) : "",
        base_price: basePrice,
        per_m2: perM2,
        min_price: minPrice,
        category: category ?? "arch",
        group: String(b.group).trim(),
        default_m2: defaultM2,
        guarantee: Boolean(b.guarantee),
        badge,
        features,
        is_active: true,
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Admin API /offer-services POST insert error:", insertError);
      captureApiError(insertError, "admin/offer-services POST insert");
      return NextResponse.json(
        { error: { message: "Hizmet eklenemedi", code: "internal" } },
        { status: 500 },
      );
    }

    // Audit log
    try {
      await writeAdminAuditLog(supabase, {
        actorId: guard.uid,
        actorEmail: guard.email,
        action: "offer_service_create",
        resource: "offer_service",
        resourceId: id,
        details: { name: String(b.name).trim(), group: String(b.group).trim() },
      });
    } catch (auditErr) {
      console.warn("Admin API /offer-services POST audit log error:", auditErr);
    }

    return NextResponse.json({ data: mapService(inserted as Record<string, unknown>) }, { status: 201 });
  } catch (err) {
    console.error("Admin API /offer-services POST error:", err);
    captureApiError(err, "admin/offer-services POST");
    return NextResponse.json(
      { error: { message: "Hizmet eklenemedi", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
export const POST = withRateLimit(postHandler, adminRateLimits.mutation);
