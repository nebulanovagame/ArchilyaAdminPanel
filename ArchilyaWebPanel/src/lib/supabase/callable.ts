import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/session";
import { BackendCallableError } from "@/lib/api/errors";

function getCallableBaseUrl() {
  return (process.env.SUPABASE_BACKEND_URL
    || process.env.NEXT_PUBLIC_BACKEND_API_URL
    || "http://127.0.0.1:8080").replace(/\/+$/, "");
}

export async function requireVerifiedSupabaseIdentity(
  sessionUser: SessionUser | null,
  accessToken: string,
) {
  if (!sessionUser) {
    throw new Error("Oturum bulunamadı.");
  }

  if (!accessToken) {
    throw new Error("Supabase kimlik bilgisi eksik.");
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error("Supabase kimliği doğrulanamadı.");
  }

  if (user.id !== sessionUser.uid) {
    throw new Error("Session ve Supabase kullanıcıları eşleşmiyor.");
  }

  return {
    uid: user.id,
    email: user.email ?? null,
    name: user.user_metadata?.name ?? null,
    picture: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
  } satisfies SessionUser;
}

export async function callBackendCallableFromServer<TPayload, TResult>(
  callableName: string,
  accessToken: string,
  payload: TPayload,
) {
  const response = await fetch(`${getCallableBaseUrl()}/call/${callableName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: payload }),
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | { data?: TResult; result?: TResult; error?: { message?: string; status?: string; code?: string } }
    | null;

  if (!response.ok || data?.error) {
    throw new BackendCallableError(
      callableName,
      data?.error?.message || `Backend callable başarısız oldu: ${callableName}`,
      data?.error?.status ?? data?.error?.code,
    );
  }

  return (data?.data ?? data?.result) as TResult;
}
