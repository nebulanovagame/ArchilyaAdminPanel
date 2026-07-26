import "server-only";

import { proxyCodexAdminRequest } from "@/lib/api/codex-admin-proxy";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";

async function handler() {
  return proxyCodexAdminRequest("/auth/codex/connection", "GET");
}

export const GET = withRateLimit(handler, adminRateLimits.read);
