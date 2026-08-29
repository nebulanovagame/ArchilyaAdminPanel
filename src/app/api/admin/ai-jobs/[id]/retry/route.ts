import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";
import { writeAdminAuditLog } from "@/lib/api/audit";
import { captureApiError } from "@/lib/api/sentry-bridge";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL?.replace(/\/$/, "") || "";
}

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

    // Prefer the backend admin API: its retry endpoint resets the job AND
    // triggers real processing (processAiStudioJob). The local DB-only update
    // cannot do that — the background worker is disabled in production, so a
    // local-only retry would leave the job stuck at "pending" forever.
    const apiBaseUrl = getApiBaseUrl();
    if (apiBaseUrl) {
      const serverClient = await createClient();
      const { data: { session } } = await serverClient.auth.getSession();
      const accessToken = session?.access_token;

      if (accessToken) {
        const upstream = await fetch(`${apiBaseUrl}/admin/ai-jobs/${id}/retry`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ reason }),
          signal: AbortSignal.timeout(8000),
        });
        const payload = await upstream.json().catch(() => null);

        if (upstream.ok) {
          // Backend writes its own audit log + job event + processing trigger.
          return NextResponse.json(payload);
        }

        // Delegation failed — do NOT fall back to the local-only update (it
        // would silently leave the job unprocessed). Surface the backend error.
        return NextResponse.json(
          payload || { error: { message: "Backend retry istegi basarisiz", code: "upstream-error" } },
          { status: upstream.status },
        );
      }
    }

    // No backend API configured: best-effort local update. The job will only
    // be processed if the background worker is enabled.
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
      captureApiError(updateError, "admin/ai-jobs/[id]/retry update");
      return NextResponse.json(
        { error: { message: "Is retry durumuna alinamadi", code: "internal" } },
        { status: 500 },
      );
    }

    try {
      await writeAdminAuditLog(supabase, {
        actorId: guard.uid,
        actorEmail: guard.email,
        action: "ai_job_manual_retry",
        resource: "ai_job",
        resourceId: id,
        workspaceId: (job as Record<string, unknown>).workspace_id as string | null || null,
        details: {
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
    captureApiError(err, "admin/ai-jobs/[id]/retry");
    return NextResponse.json(
      { error: { message: "Retry islemi basarisiz", code: "internal" } },
      { status: 500 },
    );
  }
}

export const POST = withRateLimit(handler, adminRateLimits.mutation);
