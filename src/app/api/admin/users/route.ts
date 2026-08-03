import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { captureApiError } from "@/lib/api/sentry-bridge";
import type { UserStatus } from "@/lib/api/types";

const VALID_STATUSES: readonly UserStatus[] = ["active", "suspended", "banned"];

function parseStatus(raw: unknown): UserStatus {
  if (typeof raw === "string" && (VALID_STATUSES as readonly string[]).includes(raw)) {
    return raw as UserStatus;
  }
  return "active";
}

async function handler() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, is_admin, photo_url, created_at, updated_at, credits, subscription_plan, subscription_status, total_spent, status")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const users = (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      email: (p.email as string) || "",
      displayName: (p.display_name as string) || null,
      avatarUrl: (p.photo_url as string) || null,
      role: p.is_admin ? ("admin" as const) : ("user" as const),
      status: parseStatus(p.status),
      createdAt: (p.created_at as string) || new Date().toISOString(),
      lastSignInAt: null,
      workspaceCount: 0,
      credits: (p.credits as number) || 0,
      totalCreditsUsed: Number(p.total_spent) || 0,
    }));

    return NextResponse.json({ data: users });
  } catch (err) {
    console.error("Admin API /users error:", err);
    captureApiError(err, "admin/users");
    return NextResponse.json(
      { error: { message: "Kullanicilar yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);
