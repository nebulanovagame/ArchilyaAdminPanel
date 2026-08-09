import "server-only";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";

type ProxyMethod = "GET" | "POST";

function getBackendBaseUrl(): string {
  const configured = process.env.ADMIN_BACKEND_URL
    || process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL
    || (process.env.NODE_ENV === "production"
      ? "https://api.archilya.com"
      : "http://127.0.0.1:8080");

  const parsed = new URL(configured);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Admin backend URL must use HTTP(S)");
  }

  return configured.replace(/\/+$/, "");
}

export async function proxyCodexAdminRequest(
  path: string,
  method: ProxyMethod,
  timeoutMs = 15_000,
  body?: unknown,
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if (guard instanceof NextResponse) return guard;

  try {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (error || !accessToken) {
      return NextResponse.json(
        { error: { message: "Oturum gereklidir.", code: "unauthenticated" } },
        { status: 401 },
      );
    }

    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    };

    if (body !== undefined && method !== "GET") {
      init.headers = {
        ...init.headers,
        "Content-Type": "application/json",
      };
      init.body = JSON.stringify(body);
    }

    const response = await fetch(`${getBackendBaseUrl()}${path}`, init);
    const payload = await response.json().catch(() => ({
      error: {
        message: "Backend gecersiz bir yanit verdi.",
        code: "invalid-backend-response",
      },
    }));
    const backendTraceId = response.headers.get("x-trace-id");

    return NextResponse.json(payload, {
      status: response.status,
      headers: backendTraceId ? { "X-Backend-Trace-Id": backendTraceId } : undefined,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error("[codex-admin-proxy] request failed:", {
      path,
      method,
      timedOut,
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error: {
          message: timedOut
            ? "Codex servisi zamaninda yanit vermedi."
            : "Codex servisine ulasilamadi.",
          code: timedOut ? "backend-timeout" : "backend-unavailable",
        },
      },
      { status: 503 },
    );
  }
}
