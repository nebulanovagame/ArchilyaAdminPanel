import "server-only";

/**
 * Server-side admin session utilities.
 *
 * ⚠️ IMPORTANT SECURITY NOTES:
 * - This module runs ONLY on the server (via "server-only" import).
 * - Admin role verification MUST also be done on the backend API.
 * - The frontend check is for UI protection only, not security enforcement.
 * - In production, the backend Admin API must verify:
 *   1. JWT token validity (via Supabase auth.getUser)
 *   2. Admin role from profiles.role or admin_users table
 *   3. Audit logging for all admin actions
 *   4. Rate limiting
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type AdminSessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
};

function toAdminSessionUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
  } | null;
}, profile: {
  email?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  is_admin?: boolean | null;
}): AdminSessionUser {
  return {
    uid: user.id,
    email: profile.email ?? user.email ?? null,
    displayName: profile.display_name ?? user.user_metadata?.name ?? null,
    avatarUrl: profile.photo_url ?? user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    isAdmin: profile.is_admin === true,
  };
}

export async function getOptionalAdminSession(): Promise<AdminSessionUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return null;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email, display_name, photo_url, is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.is_admin !== true) return null;

    return toAdminSessionUser(user, profile);
  } catch {
    return null;
  }
}

export async function requireAdminSession(): Promise<AdminSessionUser> {
  const sessionUser = await getOptionalAdminSession();

  if (!sessionUser) {
    redirect("/giris");
  }

  return sessionUser;
}
