import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";
import { captureApiError } from "@/lib/api/sentry-bridge";

async function handler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "").slice(0, 500);

    const supabase = createAdminClient();

    const { data: job, error: jobError } = await supabase
      .from("ai_studio_jobs")
      .select("id, user_id, status, tool_id, credit_cost, refunded, refund_amount")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: { message: "Is bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    const jobStatus = (job as Record<string, unknown>).status as string;
    if (jobStatus !== "failed" && jobStatus !== "cancelled") {
      return NextResponse.json(
        { error: { message: "Sadece basarisiz veya iptal edilmis isler icin iade yapilabilir", code: "conflict" } },
        { status: 409 },
      );
    }

    if ((job as Record<string, unknown>).refunded === true) {
      return NextResponse.json(
        { error: { message: "Bu is icin zaten iade yapilmis", code: "conflict" } },
        { status: 409 },
      );
    }

    const j = job as Record<string, unknown>;
    const refundAmount = Number(body?.amount || j.credit_cost || 0);
    if (refundAmount <= 0) {
      return NextResponse.json(
        { error: { message: "Iade edilecek islem hakki miktari gecersiz", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("ai_studio_jobs")
      .update({
        refunded: true,
        refunded_at: now,
        refund_amount: refundAmount,
        updated_at: now,
      })
      .eq("id", id);

    if (updateError) {
      console.error("Admin API /ai-jobs/[id]/refund update error:", updateError);
      captureApiError(updateError, "admin/ai-jobs/[id]/refund update");
      return NextResponse.json(
        { error: { message: "Iade durumu guncellenemedi", code: "internal" } },
        { status: 500 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("credits")
      .eq("id", j.user_id)
      .single();

    const currentCredits = Number((profile as Record<string, unknown> | null)?.credits || 0);
    const balanceAfter = currentCredits + refundAmount;

    const { error: txError } = await supabase
      .from("credit_transactions")
      .insert({
        user_id: j.user_id,
        amount: refundAmount,
        type: "credit_refund",
        description: reason || `AI is iadesi: ${id}`,
        balance_after: balanceAfter,
        source: "admin_panel",
        metadata: {
          jobId: id,
          toolId: j.tool_id,
          adminId: guard.uid,
        },
        created_at: now,
      });

    if (txError) {
      console.error("Admin API /ai-jobs/[id]/refund credit_transactions insert error:", txError);
      captureApiError(txError, "admin/ai-jobs/[id]/refund credit_transactions");
      await supabase
        .from("ai_studio_jobs")
        .update({ refunded: false, refunded_at: null, refund_amount: 0, updated_at: now })
        .eq("id", id);
      return NextResponse.json(
        { error: { message: "Kredi islemi kaydi olusturulamadi", code: "internal" } },
        { status: 500 },
      );
    }

    try {
      await supabase.rpc("increment_user_credits", {
        p_user_id: j.user_id,
        p_amount: refundAmount,
      });
    } catch (rpcErr) {
      console.error("Admin API /ai-jobs/[id]/refund RPC error:", rpcErr);
      captureApiError(rpcErr, "admin/ai-jobs/[id]/refund RPC");
    }

    try {
      await supabase.from("workspace_activity_logs").insert({
        action: "ai_job_manual_refund",
        actor_id: guard.uid,
        actor_email: guard.email,
        workspace_id: (j.workspace_id as string) || null,
        target_id: id,
        metadata: {
          userId: j.user_id,
          toolId: j.tool_id,
          amount: refundAmount,
          reason,
          adminId: guard.uid,
        },
      });
    } catch (auditErr) {
      console.warn("Admin API /ai-jobs/[id]/refund audit log error:", auditErr);
    }

    try {
      await supabase.from("ai_studio_job_events").insert({
        job_id: id,
        user_id: j.user_id,
        tool_id: j.tool_id,
        event_type: "failed",
        previous_status: jobStatus,
        new_status: jobStatus,
        reason: "Admin islem hakki iadesi",
        metadata: {
          refunded: true,
          refundAmount,
          adminId: guard.uid,
        },
        created_at: now,
      });
    } catch (eventErr) {
      console.warn("Admin API /ai-jobs/[id]/refund job event error:", eventErr);
    }

    return NextResponse.json({
      data: {
        success: true,
        jobId: id,
        refundAmount,
        message: "Kredi iadesi yapildi",
      },
    });
  } catch (err) {
    console.error("Admin API /ai-jobs/[id]/refund error:", err);
    captureApiError(err, "admin/ai-jobs/[id]/refund");
    return NextResponse.json(
      { error: { message: "Kredi iadesi yapilamadi", code: "internal" } },
      { status: 500 },
    );
  }
}

export const POST = withRateLimit(handler, adminRateLimits.mutation);
