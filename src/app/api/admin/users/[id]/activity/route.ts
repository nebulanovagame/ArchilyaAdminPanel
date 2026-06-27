import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import type { UserActivityEntry, UserActivityResponse } from "@/lib/api/types";
import {
  ACTIVITY_LIMIT,
  AI_STUDIO_BUCKET,
  MAX_ACTIVITY_LIMIT,
  MAX_ACTIVITY_WINDOW,
  SIGNED_URL_TTL_SECONDS,
  clampQueryNumber,
  createSummary,
  mapActionToType,
  safeStorageUrl,
  sanitizeMetadata,
  toRecord,
  type ActivityLogRow,
  type AiJobRow,
  type CreditTransactionRow,
} from "./activity-utils";

export const dynamic = "force-dynamic";

async function handler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id: userId } = await params;
    const url = new URL(_request.url);
    const limit = clampQueryNumber(url.searchParams.get("limit"), ACTIVITY_LIMIT, MAX_ACTIVITY_LIMIT);
    const offset = clampQueryNumber(url.searchParams.get("offset"), 0, MAX_ACTIVITY_WINDOW);
    const fetchLimit = Math.min(offset + limit + 1, MAX_ACTIVITY_WINDOW);
    const typeFilter = url.searchParams.get("type") || null;

    const supabase = createAdminClient();

    // ─── 1. Fetch workspace_activity_logs ───
    const activityQuery = supabase
      .from("workspace_activity_logs")
      .select("id, action, actor_id, target_type, target_id, target_name, category, metadata, created_at")
      .eq("actor_id", userId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    const { data: activityLogs } = await activityQuery;

    // ─── 2. Fetch ai_studio_jobs for this user (for input/output images) ───
    const aiJobsQuery = supabase
      .from("ai_studio_jobs")
      .select("id, user_id, tool_id, status, result_url, result_text, metadata, feedback, created_at, completed_at, failed_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    const { data: aiJobs } = await aiJobsQuery;

    // ─── 3. Fetch credit_transactions ───
    const creditsQuery = supabase
      .from("credit_transactions")
      .select("id, user_id, amount, balance_after, description, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    const { data: creditTx } = await creditsQuery;

    const activityLogRows = (activityLogs || []) as ActivityLogRow[];
    const creditRows = (creditTx || []) as CreditTransactionRow[];
    const aiJobRows = (aiJobs || []) as AiJobRow[];
    const aiJobById = new Map<string, AiJobRow>();
    for (const job of aiJobRows) {
      if (job.id) aiJobById.set(String(job.id), job);
    }

    async function createInputSignedUrl(inputPath: string | null): Promise<string | null> {
      if (!inputPath) return null;
      const { data: signed, error: signedError } = await supabase.storage
        .from(AI_STUDIO_BUCKET)
        .createSignedUrl(inputPath, SIGNED_URL_TTL_SECONDS);

      if (signedError) {
        console.warn("[admin/users/activity] input signed URL error:", signedError.message);
        return null;
      }

      return safeStorageUrl(signed?.signedUrl || null);
    }

    async function enrichAiFields(entry: UserActivityEntry, jobId: string | null): Promise<UserActivityEntry> {
      if (!jobId) return entry;
      const job = aiJobById.get(jobId);
      if (!job) return entry;

      const jobMeta = toRecord(job.metadata);
      const safeJobMeta = sanitizeMetadata(jobMeta);
      const input = (jobMeta.input as { primaryImage?: { path?: string } }) || {};
      const inputPath = input.primaryImage?.path || (entry.metadata?.inputImagePath as string | undefined) || null;

      return {
        ...entry,
        toolId: entry.toolId || job.tool_id || undefined,
        resultUrl: safeStorageUrl(job.result_url) || safeStorageUrl(entry.resultUrl || null),
        resultText: job.result_text || entry.resultText || null,
        inputImagePath: inputPath,
        inputImageUrl: await createInputSignedUrl(inputPath),
        metadata: {
          ...(entry.metadata || {}),
          jobStatus: job.status,
          jobMetadata: safeJobMeta,
        },
      };
    }

    // ─── 4. Transform activity logs ───
    const activityEntries = await Promise.all(activityLogRows.map(async (log): Promise<UserActivityEntry> => {
      const meta = sanitizeMetadata(toRecord(log.metadata));
      const jobId = String(log.target_id || meta.jobId || "") || null;
      const entry: UserActivityEntry = {
        id: `act-${log.id}`,
        type: mapActionToType(log.action),
        action: log.action,
        category: log.category || "",
        createdAt: log.created_at || "",
        toolId: (meta.toolId as string) || (meta.tool_id as string) || undefined,
        resultUrl: null,
        creditAmount: (meta.amount as number) || (meta.creditCost as number) || undefined,
        metadata: meta,
        summary: createSummary({ action: log.action, toolId: (meta.toolId as string) || (meta.tool_id as string), creditAmount: (meta.amount as number) }),
      };
      return enrichAiFields(entry, jobId);
    }));

    // ─── 5. Transform AI jobs ───
    const activityJobIds = new Set(activityLogRows.map((log) => String(log.target_id || "")).filter(Boolean));
    const jobEntries = await Promise.all(aiJobRows
      .filter((job) => !activityJobIds.has(String(job.id)))
      .map(async (job): Promise<UserActivityEntry> => {
        const jobMeta = toRecord(job.metadata);
        const safeJobMeta = sanitizeMetadata(jobMeta);
        const input = (jobMeta.input as { primaryImage?: { path?: string } }) || {};
        const inputPath = input.primaryImage?.path || null;

        const billing = (jobMeta.billing as Record<string, unknown>) || {};
        const creditCost = Number((jobMeta.creditCost as number) || (billing.amount as number) || 0);

        return {
          id: `job-${job.id}`,
          type: job.status === "completed" ? "ai_job_completed" : job.status === "failed" ? "ai_job_failed" : "ai_job_created",
          action: `aiJob${job.status.charAt(0).toUpperCase() + job.status.slice(1)}`,
          category: "ai",
          createdAt: job.created_at || "",
          toolId: job.tool_id || undefined,
          resultUrl: safeStorageUrl(job.result_url),
          resultText: job.result_text,
          inputImagePath: inputPath,
          inputImageUrl: await createInputSignedUrl(inputPath),
          metadata: safeJobMeta,
          summary: `AI ${job.tool_id || "işi"}: ${job.status === "completed" ? "Tamamlandı" : job.status === "failed" ? "Başarısız" : "İşleniyor"}`,
          creditAmount: creditCost,
        };
      }));

    // ─── 6. Transform credit transactions ───
    const creditEntries: UserActivityEntry[] = creditRows.map((tx) => {
      const amount = Number(tx.amount || 0);

      return {
        id: `cred-${tx.id}`,
        type: "credit",
        action: amount > 0 ? "credit_grant" : "credit_deduct",
        category: "credit",
        createdAt: tx.created_at || "",
        creditAmount: Math.abs(amount),
        creditBalanceAfter: tx.balance_after || undefined,
        summary: amount > 0
          ? `${Math.abs(amount)} kredi yüklendi${tx.description ? ` (${tx.description})` : ""}`
          : `${Math.abs(amount)} kredi düşüldü${tx.description ? ` (${tx.description})` : ""}`,
        metadata: sanitizeMetadata(toRecord(tx.metadata)),
      };
    });

    // ─── 7. Merge & sort all entries by createdAt desc ───
    const allEntries = [...activityEntries, ...jobEntries, ...creditEntries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // ─── 8. Filter by type if specified ───
    const filteredEntries = typeFilter
      ? allEntries.filter((e) => e.type === typeFilter)
      : allEntries;

    const pagedEntries = filteredEntries.slice(offset, offset + limit);

    const response: UserActivityResponse = {
      entries: pagedEntries,
      total: filteredEntries.length,
      hasMore: filteredEntries.length > offset + limit
        || activityLogRows.length >= fetchLimit
        || aiJobRows.length >= fetchLimit
        || creditRows.length >= fetchLimit,
    };

    return NextResponse.json({ data: response });
  } catch (err) {
    console.error("Admin API /users/[id]/activity error:", err);
    return NextResponse.json(
      { error: { message: "Aktivite verisi alinirken hata olustu", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
