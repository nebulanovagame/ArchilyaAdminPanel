import "server-only";

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

/**
 * GET /api/admin/me
 *
 * Checks if the current session user is an admin by querying
 * the Supabase profiles table. This replaces the external
 * backend Admin API for the initial auth check.
 *
 * Security: Only returns admin info if the user has a valid
 * session AND their profile has is_admin = true.
 */
async function handler() {
  try {
    const supabase = await createClient();

    // 1. Get the authenticated user from the session cookie
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: { message: "Oturum bulunamadı", code: "unauthenticated" } },
        { status: 401 },
      );
    }

    // 2. Query the profiles table for admin status
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, is_admin, display_name, photo_url, created_at")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: { message: "Profil bulunamadı", code: "profile-not-found" } },
        { status: 403 },
      );
    }

    if (!profile.is_admin) {
      return NextResponse.json(
        { error: { message: "Admin yetkiniz bulunmuyor", code: "not-admin" } },
        { status: 403 },
      );
    }

    // 3. Return admin user info
    return NextResponse.json({
      data: {
        uid: profile.id,
        email: profile.email,
        role: "admin" as const,
        displayName: profile.display_name,
        avatarUrl: profile.photo_url,
        createdAt: profile.created_at,
        lastSignInAt: user.last_sign_in_at,
      },
    });
  } catch (err) {
    console.error("Admin API /me error:", err);
    return NextResponse.json(
      { error: { message: "Sunucu hatası", code: "internal" } },
      { status: 500 },
    );
  }
}

export const GET = withRateLimit(handler, adminRateLimits.auth);
