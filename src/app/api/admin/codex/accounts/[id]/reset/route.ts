import "server-only";

import { NextResponse } from "next/server";
import { proxyCodexAdminRequest } from "@/lib/api/codex-admin-proxy";
import { adminRateLimits, withRateLimit } from "@/lib/api/rate-limit";
import { rejectCrossSiteMutation } from "@/lib/api/security";

async function postHandler(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossSiteMutation(_request);
  if (originError) return originError;

  const { id } = await params;
  const accountId = Number(id);

  if (!Number.isFinite(accountId) || accountId <= 0 || !Number.isInteger(accountId)) {
    return NextResponse.json(
      { error: { message: "Gecersiz hesap kimligi.", code: "invalid-account-id" } },
      { status: 400 },
    );
  }

  return proxyCodexAdminRequest(
    `/auth/codex/accounts/${accountId}/reset`,
    "POST",
    15_000,
  );
}

export const POST = withRateLimit(postHandler, adminRateLimits.sensitiveMutation);
