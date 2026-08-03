import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";
import { captureApiError } from "@/lib/api/sentry-bridge";
import type { UserStatus } from "@/lib/api/types";

const VALID_STATUSES: readonly UserStatus[] = ["active", "suspended", "banned"];

function parseStatus(raw: unknown): UserStatus {
  if (typeof raw === "string" && (VALID_STATUSES as readonly string[]).includes(raw)) {
    return raw as UserStatus;
  }
  return "active";
}

// ─── GET handler ────────────────────────────────────────

async function handler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, is_admin, photo_url, created_at, updated_at, credits, subscription_plan, subscription_status, total_spent, status")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: { message: "Kullanici bulunamadi", code: "not-found" } },
        { status: 404 },
      );
    }

    const user = {
      id: data.id,
      email: data.email || "",
      displayName: data.display_name || null,
      avatarUrl: data.photo_url || null,
      role: data.is_admin ? ("admin" as const) : ("user" as const),
      status: parseStatus(data.status),
      createdAt: data.created_at || new Date().toISOString(),
      lastSignInAt: null,
      workspaceCount: 0,
      credits: Number(data.credits) || 0,
      totalCreditsUsed: Number(data.total_spent) || 0,
    };

    return NextResponse.json({ data: user });
  } catch (err) {
    console.error("Admin API /users/[id] error:", err);
    captureApiError(err, "admin/users/[id]");
    return NextResponse.json(
      { error: { message: "Kullanici yuklenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.read);

// ─── PATCH handler ──────────────────────────────────────

async function patchHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Self-protection
    if (guard.uid === id) {
      return NextResponse.json(
        { error: { message: "Kendi hesabinizi degistiremezsiniz", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const changes: { status?: UserStatus; isAdmin?: boolean } = {};
    const changeDescriptions: string[] = [];

    // Validate status
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !(VALID_STATUSES as readonly string[]).includes(body.status)) {
        return NextResponse.json(
          { error: { message: "Gecersiz status degeri. active, suspended veya banned olmalidir.", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      changes.status = body.status as UserStatus;
      changeDescriptions.push(`status: ${body.status}`);
    }

    // Validate isAdmin
    if (body.isAdmin !== undefined) {
      if (typeof body.isAdmin !== "boolean") {
        return NextResponse.json(
          { error: { message: "isAdmin boolean olmalidir.", code: "invalid-argument" } },
          { status: 400 },
        );
      }
      changes.isAdmin = body.isAdmin;
      changeDescriptions.push(`isAdmin: ${body.isAdmin}`);
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json(
        { error: { message: "Guncellenecek alan belirtilmedi.", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Step 1: Sync Supabase Auth first (before profiles update)
    if (changes.status !== undefined) {
      const authParams: Record<string, unknown> = {};

      switch (changes.status) {
        case "banned":
          authParams.ban_duration = "none";
          break;
        case "suspended":
          authParams.ban_duration = "24h";
          break;
        case "active":
          // Unban: first reset ban_duration, then explicitly clear banned_until
          authParams.ban_duration = "none";
          break;
      }

      const { error: authError } = await supabase.auth.admin.updateUserById(id, authParams);
      if (authError) {
        console.error("Admin API /users/[id] PATCH auth sync error:", authError);
        captureApiError(authError, "admin/users/[id]/PATCH/auth");
        return NextResponse.json(
          { error: { message: "Auth senkronu basarisiz", code: "internal" } },
          { status: 500 },
        );
      }

      // For "active" status, also clear banned_until to fully unban
      if (changes.status === "active") {
        const { error: unbanError } = await supabase.auth.admin.updateUserById(id, {
          banned_until: null as unknown as string,
        } as Record<string, unknown>);
        if (unbanError) {
          console.error("Admin API /users/[id] PATCH unban error:", unbanError);
          captureApiError(unbanError, "admin/users/[id]/PATCH/unban");
          return NextResponse.json(
            { error: { message: "Auth senkronu basarisiz", code: "internal" } },
            { status: 500 },
          );
        }
      }
    }

    // Step 2: Update profiles table
    const profileUpdate: Record<string, unknown> = {};
    if (changes.status !== undefined) {
      profileUpdate.status = changes.status;
    }
    if (changes.isAdmin !== undefined) {
      profileUpdate.is_admin = changes.isAdmin;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", id);

    if (profileError) {
      console.error("Admin API /users/[id] PATCH profile update error:", profileError);
      captureApiError(profileError, "admin/users/[id]/PATCH/profile");
      return NextResponse.json(
        { error: { message: "Profil guncellenirken hata", code: "internal" } },
        { status: 500 },
      );
    }

    // Step 3: Audit log
    const action = changes.status !== undefined && changes.isAdmin !== undefined
      ? "user_update"
      : changes.status !== undefined
        ? "user_status_change"
        : "user_role_change";

    try {
      await supabase.from("workspace_activity_logs").insert({
        action,
        actor_id: guard.uid,
        actor_email: guard.email,
        workspace_id: null,
        target_id: id,
        metadata: {
          changes: changeDescriptions,
          adminId: guard.uid,
          previousStatus: undefined, // will be blank; UI shows new state on reload
        },
      });
    } catch (auditErr) {
      console.warn("Admin API /users/[id] PATCH audit log error:", auditErr);
    }

    return NextResponse.json({
      data: { success: true, id, changes },
    });
  } catch (err) {
    console.error("Admin API /users/[id] PATCH error:", err);
    captureApiError(err, "admin/users/[id]/PATCH");
    return NextResponse.json(
      { error: { message: "Kullanici guncellenirken hata", code: "internal" } },
      { status: 500 },
    );
  }
}

export const PATCH = withRateLimit(patchHandler, adminRateLimits.mutation);
