import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";
import { captureApiError } from "@/lib/api/sentry-bridge";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getHandler(request: Request) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 50)));
    const fromRange = (page - 1) * limit;
    const toRange = fromRange + limit - 1;

    const supabase = createAdminClient();

    const { data, error, count } = await supabase
      .from("profiles")
      .select("id, email, display_name, is_beta_tester, created_at", { count: "exact" })
      .eq("is_beta_tester", true)
      .order("created_at", { ascending: false })
      .range(fromRange, toRange);

    if (error) throw error;

    return NextResponse.json({
      data: {
        testers: (data || []) as Array<{
          id: string;
          email: string;
          display_name: string | null;
          is_beta_tester: boolean;
          created_at: string;
        }>,
        total: count || 0,
        page,
        limit,
      },
    });
  } catch (err) {
    console.error("Admin API /beta/testers GET error:", err);
    captureApiError(err, "admin/beta/testers");
    return NextResponse.json(
      { error: { message: "Beta testci verisi yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

async function postHandler(request: Request) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const body = await request.json().catch(() => ({}));
    const rawEmail = String(body?.email || "").trim().toLowerCase();
    const action = body?.action;

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json(
        { error: { message: "Gecerli bir e-posta adresi girin", code: "validation" } },
        { status: 400 },
      );
    }

    if (action !== "add" && action !== "remove") {
      return NextResponse.json(
        { error: { message: "Gecersiz islem: 'add' veya 'remove' olmalidir", code: "validation" } },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, is_beta_tester")
      .eq("email", rawEmail)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { message: "Bu e-posta ile kayitli kullanici bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    if (action === "add" && profile.is_beta_tester) {
      return NextResponse.json(
        { error: { message: "Kullanici zaten beta testcisi", code: "conflict" } },
        { status: 409 },
      );
    }

    if (action === "remove" && !profile.is_beta_tester) {
      return NextResponse.json(
        { error: { message: "Kullanici zaten beta testcisi degil", code: "conflict" } },
        { status: 409 },
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ is_beta_tester: action === "add" })
      .eq("id", profile.id);

    if (updateError) {
      console.error("Admin API /beta/testers update error:", updateError);
      captureApiError(updateError, "admin/beta/testers update");
      return NextResponse.json(
        { error: { message: "Beta testci durumu guncellenemedi", code: "internal" } },
        { status: 500 },
      );
    }

    try {
      await supabase.from("workspace_activity_logs").insert({
        action: "beta_tester_manage",
        actor_id: guard.uid,
        actor_email: guard.email ?? "unknown",
        workspace_id: null,
        target_id: profile.id,
        metadata: { email: rawEmail, action },
      });
    } catch (auditErr) {
      console.warn("Admin API /beta/testers audit log error:", auditErr);
    }

    return NextResponse.json({
      data: {
        success: true,
        email: rawEmail,
        action,
        message:
          action === "add"
            ? "Beta testcisi eklendi"
            : "Beta testcisi cikarildi",
      },
    });
  } catch (err) {
    console.error("Admin API /beta/testers POST error:", err);
    captureApiError(err, "admin/beta/testers");
    return NextResponse.json(
      { error: { message: "Beta testci islemi basarisiz", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
export const POST = withRateLimit(postHandler, adminRateLimits.mutation);
