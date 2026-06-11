import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "").slice(0, 500);

    const supabase = createAdminClient();

    const { data: job, error: jobError } = await supabase
      .from("ai_studio_jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: { message: "Is bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    if ((job as Record<string, unknown>).status !== "failed") {
      return NextResponse.json(
        { error: { message: "Sadece failed isler retry edilebilir", code: "conflict" } },
        { status: 409 },
      );
    }

    const billing = ((job as Record<string, unknown>).billing as Record<string, unknown> | null) || {};
    const nextBilling = { ...billing };

    if (billing.status === "refunded") {
      nextBilling.status = "not_charged";
      nextBilling.refundedAt = null;
      nextBilling.refundTransactionId = null;
      nextBilling.refundError = null;
    }

    const { error: updateError } = await supabase
      .from("ai_studio_jobs")
      .update({
        status: "pending",
        attempt_count: 0,
        locked_at: null,
        failed_at: null,
        error_message: null,
        last_attempt_error: null,
        dead_letter: null,
        billing: nextBilling,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "failed");

    if (updateError) {
      console.error("Admin API /ai-jobs/[id]/retry update error:", updateError);
      return NextResponse.json(
        { error: { message: "Is retry durumuna alinamadi", code: "internal" } },
        { status: 500 },
      );
    }

    try {
      await supabase.from("workspace_activity_logs").insert({
        action: "ai_job_manual_retry",
        actor_id: "admin-panel",
        actor_email: "admin@archilya.com",
        workspace_id: (job as Record<string, unknown>).workspace_id || null,
        target_id: id,
        metadata: {
          userId: (job as Record<string, unknown>).user_id,
          toolId: (job as Record<string, unknown>).tool_id,
          previousStatus: "failed",
          newStatus: "pending",
          reason,
          billingReset: billing.status === "refunded",
        },
      });
    } catch (auditErr) {
      console.warn("Admin API /ai-jobs/[id]/retry audit log error:", auditErr);
    }

    return NextResponse.json({
      data: {
        success: true,
        jobId: id,
        newStatus: "pending",
        billingReset: billing.status === "refunded",
      },
    });
  } catch (err) {
    console.error("Admin API /ai-jobs/[id]/retry error:", err);
    return NextResponse.json(
      { error: { message: "Retry islemi basarisiz", code: "internal" } },
      { status: 500 },
    );
  }
}
