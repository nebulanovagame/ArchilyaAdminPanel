import "server-only";

import { proxyCodexAdminRequest } from "@/lib/api/codex-admin-proxy";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";

async function postHandler(request: Request) {
  const originError = rejectCrossSiteMutation(request);
  if (originError) return originError;

  return proxyCodexAdminRequest("/auth/codex/accounts", "POST", 15_000);
}

export const POST = withRateLimit(postHandler, adminRateLimits.sensitiveMutation);
