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
  return proxyCodexAdminRequest("/auth/codex/session", "POST", 20_000);
}

export const GET = withRateLimit(getHandler, adminRateLimits.read);
export const POST = withRateLimit(postHandler, adminRateLimits.sensitiveMutation);
