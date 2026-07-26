import "server-only";

import { NextResponse } from "next/server";
import { proxyCodexAdminRequest } from "@/lib/api/codex-admin-proxy";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

async function handler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { error: { message: "Gecersiz oturum kimligi.", code: "invalid-argument" } },
      { status: 400 },
    );
  }
  return proxyCodexAdminRequest(`/auth/codex/session/${encodeURIComponent(id)}`, "GET");
}

export const GET = withRateLimit(handler, adminRateLimits.read);
