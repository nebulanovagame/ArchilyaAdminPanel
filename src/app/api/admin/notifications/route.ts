import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { writeAdminAuditLog } from "@/lib/api/audit";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";

const MAX_TITLE_LENGTH = 120;
const MAX_BODY_LENGTH = 2_000;
const MAX_TARGET_USERS = 500;
const VALID_TYPE_PATTERN = /^[a-z0-9_-]{1,64}$/;

async function handler(_request: Request) {
  const originError = rejectCrossSiteMutation(_request);
  if (originError) return originError;

  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    let body: {
      title?: string;
      body?: string;
      type?: string;
      targetUserIds?: string[];
      confirmBroadcast?: boolean;
    };
    try {
      body = await _request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Gecersiz JSON", code: "invalid-body" } },
        { status: 400 },
      );
    }

    const title = (body.title || "").trim();
    const bodyText = (body.body || "").trim();
    const type = (body.type || "broadcast").trim();
    const targetUserIds = Array.isArray(body.targetUserIds)
      ? body.targetUserIds.map((id) => String(id).trim()).filter(Boolean)
      : null;

    if (!title || !bodyText) {
      return NextResponse.json(
        { error: { message: "title ve body alanlari zorunludur", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    if (title.length > MAX_TITLE_LENGTH || bodyText.length > MAX_BODY_LENGTH || !VALID_TYPE_PATTERN.test(type)) {
      return NextResponse.json(
        { error: { message: "Bildirim alani gecersiz veya cok uzun", code: "invalid-argument" } },
        { status: 400 },
      );
    }

    if (targetUserIds && targetUserIds.length > MAX_TARGET_USERS) {
      return NextResponse.json(
        { error: { message: "Tek istekte en fazla 500 hedef kullanici secilebilir", code: "too-many-targets" } },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    let userIds = targetUserIds;

    // If no specific targets → send to ALL users
    if (!userIds || userIds.length === 0) {
      if (body.confirmBroadcast !== true) {
        return NextResponse.json(
          { error: { message: "Tum kullanicilara bildirim icin confirmBroadcast gereklidir", code: "broadcast-confirmation-required" } },
          { status: 400 },
        );
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id");

      if (profileError) {
        return NextResponse.json(
          { error: { message: "Kullanicilar alinamadi", code: "internal" } },
          { status: 500 },
        );
      }

      userIds = (profiles || []).map((p) => p.id);
    }

    if (userIds.length === 0) {
      return NextResponse.json({
        data: { success: true, sentCount: 0, message: "Hedef kullanici bulunamadi." },
      });
    }

    // Build notification rows
    const rows = userIds.map((uid) => ({
      user_id: uid,
      type,
      title,
      body: bodyText,
      data: {
        sentBy: guard.uid,
        sentByEmail: guard.email || "unknown",
      },
    }));

    // Batch insert in chunks of 500
    const CHUNK_SIZE = 500;
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const { data: inserted, error: insertError } = await supabase
        .from("notifications")
        .insert(chunk)
        .select("id");

      if (insertError) throw insertError;
      if (inserted) insertedCount += inserted.length;
    }

    // Log activity
    await writeAdminAuditLog(supabase, {
      actorId: guard.uid,
      actorEmail: guard.email,
      action: "send_notification",
      resource: "notifications",
      resourceId: targetUserIds ? "targeted" : "broadcast",
      details: {
        type,
        title,
        targetCount: userIds.length,
        hasSpecificTargets: !!targetUserIds,
      },
    });

    return NextResponse.json({
      data: {
        success: true,
        sentCount: rows.length,
        insertedCount,
      },
    });
  } catch (err) {
    console.error("Admin API /notifications error:", err);
    return NextResponse.json(
      { error: { message: "Bildirim gonderilirken hata olustu", code: "internal" } },
      { status: 500 },
    );
  }
}

export const POST = withRateLimit(handler, adminRateLimits.broadcast);
