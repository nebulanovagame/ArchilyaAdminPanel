import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { captureApiError } from "@/lib/api/sentry-bridge";

const FEEDBACK_SELECT = "id, user_id, user_email, category, message, page_path, status, admin_note, is_read, created_at, updated_at";

const VALID_STATUSES = ["new", "in_review", "done", "wont_do", "closed"];

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
      is_read: true,
      updated_at: new Date().toISOString(),
    };
    if (body.adminNote !== undefined) {
      updateData.admin_note = body.adminNote;
    }

    const { data, error } = await supabase
      .from("feedback")
      .update(updateData)
      .eq("id", id)
      .select(FEEDBACK_SELECT)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { message: "Geri bildirim bulunamadı.", code: "not-found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: mapFeedback(data) });
  } catch (err) {
    console.error("Admin API /feedback/[id] PATCH error:", err);
    captureApiError(err, "admin/feedback/[id] PATCH");
    return NextResponse.json(
      { error: { message: "Geri bildirim güncellenemedi.", code: "internal" } },
      { status: 500 },
    );
  }
}

export const PATCH = withRateLimit(patchHandler, adminRateLimits.mutation);
