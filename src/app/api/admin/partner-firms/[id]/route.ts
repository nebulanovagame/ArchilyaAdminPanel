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
      .from("partner_firms")
      .select(FIRM_SELECT)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { message: "Firma bulunamadı.", code: "not-found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: mapFirm(data) });
  } catch (err) {
    console.error("Admin API /partner-firms/[id] GET error:", err);
    return NextResponse.json(
      { error: { message: "Firma bilgisi alınamadı.", code: "internal" } },
      { status: 500 },
    );
  }
}

async function updateHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.latitude !== undefined) updateData.latitude = body.latitude;
    if (body.longitude !== undefined) updateData.longitude = body.longitude;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.website !== undefined) updateData.website = body.website;
    if (body.socialMedia !== undefined) updateData.social_media = body.socialMedia;
    if (body.logoUrl !== undefined) updateData.logo_url = body.logoUrl;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.isActive !== undefined) updateData.is_active = body.isActive;
    if (body.orderIndex !== undefined) updateData.order_index = body.orderIndex;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("partner_firms")
      .update(updateData)
      .eq("id", id)
      .select(FIRM_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { message: "Firma güncellenemedi.", code: "not-found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: mapFirm(data) });
  } catch (err) {
    console.error("Admin API /partner-firms/[id] PUT error:", err);
    return NextResponse.json(
      { error: { message: "Firma güncellenemedi.", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
export const PUT = withRateLimit(updateHandler, adminRateLimits.mutation);
