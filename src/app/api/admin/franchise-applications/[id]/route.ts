import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

const APPLICATION_SELECT = "id, name, company, city, phone, email, budget_range, message, status, admin_note, created_at, updated_at";

function mapApplication(a: Record<string, unknown>) {
  return {
    id: a.id as string,
    name: a.name as string,
    company: a.company as string | null,
    city: a.city as string | null,
    phone: a.phone as string | null,
    email: a.email as string | null,
    budgetRange: a.budget_range as string | null,
    message: a.message as string | null,
    status: a.status as string,
    adminNote: a.admin_note as string | null,
    createdAt: a.created_at as string,
    updatedAt: a.updated_at as string,
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
      .from("franchise_applications")
      .select(APPLICATION_SELECT)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { message: "Başvuru bulunamadı.", code: "not-found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: mapApplication(data) });
  } catch (err) {
    console.error("Admin API /franchise-applications/[id] GET error:", err);
    return NextResponse.json(
      { error: { message: "Başvuru bilgisi alınamadı.", code: "internal" } },
      { status: 500 },
    );
  }
}

async function patchHandler(
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

  const VALID_STATUSES = ["pending", "contacted", "qualified", "rejected", "closed"];
  if (!body.status || !VALID_STATUSES.includes(body.status as string)) {
    return NextResponse.json(
      { error: { message: "Geçersiz durum değeri.", code: "validation" } },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const updateData: Record<string, unknown> = {
      status: body.status,
      updated_at: new Date().toISOString(),
    };
    if (body.adminNote !== undefined) {
      updateData.admin_note = body.adminNote;
    }

    const { data, error } = await supabase
      .from("franchise_applications")
      .update(updateData)
      .eq("id", id)
      .select(APPLICATION_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { message: "Başvuru güncellenemedi.", code: "not-found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: mapApplication(data) });
  } catch (err) {
    console.error("Admin API /franchise-applications/[id] PATCH error:", err);
    return NextResponse.json(
      { error: { message: "Başvuru güncellenemedi.", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
export const PATCH = withRateLimit(patchHandler, adminRateLimits.mutation);
