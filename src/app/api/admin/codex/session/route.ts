import "server-only";

import { proxyCodexAdminRequest } from "@/lib/api/codex-admin-proxy";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";

async function getHandler() {
  return proxyCodexAdminRequest("/auth/codex/session", "GET");
}

async function postHandler(request: Request) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const accountId = typeof body.accountId === "number" ? body.accountId : undefined;

  return proxyCodexAdminRequest(
    "/auth/codex/session",
    "POST",
    20_000,
    accountId !== undefined ? { accountId } : undefined,
  );
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
export const POST = withRateLimit(postHandler, adminRateLimits.sensitiveMutation);
