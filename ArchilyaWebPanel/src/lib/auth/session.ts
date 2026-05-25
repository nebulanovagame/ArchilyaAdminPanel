import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import {
  buildAuthRedirectHref,
  PANEL_LAST_PATH_COOKIE_NAME,
} from "@/lib/auth/redirect";

export const SESSION_COOKIE_NAME = "archilya_panel_session";
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5;

export type SessionUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
};

function toSessionUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
  } | null;
  email_confirmed_at?: string | null;
}): SessionUser {
  return {
    uid: user.id,
    email: user.email ?? null,
    name: user.user_metadata?.name ?? null,
    picture: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
  };
}

export async function getOptionalSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return toSessionUser(user);
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const sessionUser = await getOptionalSessionUser();

  if (!sessionUser) {
    const cookieStore = await cookies();
    const lastPanelPath = cookieStore.get(PANEL_LAST_PATH_COOKIE_NAME)?.value;

    redirect(buildAuthRedirectHref(lastPanelPath));
  }

  return sessionUser;
}

export async function getSessionCookieValue() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? "";
}

// Legacy helpers removed — all auth now uses Supabase.
