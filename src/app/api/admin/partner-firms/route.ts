import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

const FIRM_SELECT = "id, name, type, category, address, city, country, latitude, longitude, phone, email, website, social_media, logo_url, description, is_active, order_index, created_at, updated_at";

function mapFirm(f: Record<string, unknown>) {
  return {
    id: f.id as string,
    name: f.name as string,
    type: f.type as string,
    category: f.category as string,
    address: f.address as string | null,
    city: f.city as string | null,
    country: f.country as string,
    latitude: f.latitude as number | null,
    longitude: f.longitude as number | null,
    phone: f.phone as string | null,
    email: f.email as string | null,
    website: f.website as string | null,
    socialMedia: (f.social_media as Record<string, string>) || {},
    logoUrl: f.logo_url as string | null,
    description: f.description as string | null,
    isActive: f.is_active as boolean,
    orderIndex: f.order_index as number,
    createdAt: f.created_at as string,
    updatedAt: f.updated_at as string,
  };
}

async function listHandler(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const supabase = createAdminClient();
    let query = supabase
      .from("partner_firms")
      .select(FIRM_SELECT)
      .order("order_index", { ascending: true });

    if (type) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: (data || []).map(mapFirm) });
  } catch (err) {
    console.error("Admin API /partner-firms error:", err);
    return NextResponse.json(
      { error: { message: "Firmalar listelenemedi.", code: "internal" } },
      { status: 500 },
    );
  }
}

async function createHandler(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Geçersiz istek gövdesi.", code: "invalid-body" } },
      { status: 400 },
    );
  }

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: { message: "Firma adı gereklidir.", code: "validation" } },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("partner_firms")
      .insert({
        name: body.name,
        type: body.type || "partner",
        category: body.category || "diger",
        address: body.address || null,
        city: body.city || null,
        country: body.country || "Türkiye",
        latitude: body.latitude || null,
        longitude: body.longitude || null,
        phone: body.phone || null,
        email: body.email || null,
        website: body.website || null,
        social_media: body.socialMedia || {},
        logo_url: body.logoUrl || null,
        description: body.description || null,
        is_active: body.isActive !== false,
        order_index: body.orderIndex ?? 0,
      })
      .select(FIRM_SELECT)
      .single();

    if (error) throw error;

    return NextResponse.json({ data: mapFirm(data) }, { status: 201 });
  } catch (err) {
    console.error("Admin API /partner-firms POST error:", err);
    return NextResponse.json(
      { error: { message: "Firma oluşturulamadı.", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(listHandler, adminRateLimits.read);
export const POST = withRateLimit(createHandler, adminRateLimits.mutation);
