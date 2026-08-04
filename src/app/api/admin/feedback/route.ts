import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { captureApiError } from "@/lib/api/sentry-bridge";

const FEEDBACK_SELECT = "id, user_id, user_email, category, message, page_path, status, admin_note, is_read, created_at, updated_at";

function mapFeedback(f: Record<string, unknown>) {
  return {
    id: f.id as string,
    userId: f.user_id as string | null,
    userEmail: f.user_email as string | null,
    category: f.category as string,
    message: f.message as string,
    pagePath: f.page_path as string | null,
    status: f.status as string,
    adminNote: f.admin_note as string | null,
    isRead: f.is_read as boolean,
    createdAt: f.created_at as string,
    updatedAt: f.updated_at as string,
  };
}

async function listHandler(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    const supabase = createAdminClient();
    let query = supabase
      .from("feedback")
      .select(FEEDBACK_SELECT)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data: (data || []).map(mapFeedback) });
  } catch (err) {
    console.error("Admin API /feedback error:", err);
    captureApiError(err, "admin/feedback GET");
    return NextResponse.json(
      { error: { message: "Geri bildirimler listelenemedi.", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(listHandler, adminRateLimits.read);
