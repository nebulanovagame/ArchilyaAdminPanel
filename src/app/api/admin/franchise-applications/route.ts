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

async function listHandler(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const supabase = createAdminClient();
    let query = supabase
      .from("franchise_applications")
      .select(APPLICATION_SELECT)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: (data || []).map(mapApplication) });
  } catch (err) {
    console.error("Admin API /franchise-applications error:", err);
    return NextResponse.json(
      { error: { message: "Başvurular listelenemedi.", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(listHandler, adminRateLimits.read);
