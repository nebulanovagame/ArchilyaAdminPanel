import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  writeAdminAuditLog: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdmin: authMocks.requireAdmin,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: authMocks.createAdminClient,
}));

vi.mock("@/lib/api/audit", () => ({
  writeAdminAuditLog: authMocks.writeAdminAuditLog,
}));

import { POST } from "./route";

const routeContext = { params: Promise.resolve({ id: "user-1" }) };

function makeCreditRequest(body: unknown) {
  return new Request("https://admin.archilya.com/api/admin/users/user-1/credits", {
    method: "POST",
    headers: {
      host: "admin.archilya.com",
      origin: "https://admin.archilya.com",
      "x-forwarded-proto": "https",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/users/[id]/credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.createAdminClient.mockReturnValue({ rpc: authMocks.rpc });
    authMocks.rpc.mockResolvedValue({
      data: [{ success: true, balance_after: 250, transaction_id: "tx-1", already_applied: false }],
      error: null,
    });
    authMocks.writeAdminAuditLog.mockResolvedValue(undefined);
  });

  it("rejects cross-site mutation attempts before auth/database work", async () => {
    const response = await POST(
      new Request("https://admin.archilya.com/api/admin/users/user-1/credits", {
        method: "POST",
        headers: {
          host: "admin.archilya.com",
          origin: "https://attacker.example",
          "x-forwarded-proto": "https",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "grant", amount: 100, idempotencyKey: "valid_key_123" }),
      }),
      routeContext,
    );

    expect(response.status).toBe(403);
    expect(authMocks.requireAdmin).not.toHaveBeenCalled();
  });

  it("requires an idempotency key for credit mutations", async () => {
    authMocks.requireAdmin.mockResolvedValue({ uid: "admin-1", email: "admin@archilya.com" });

    const response = await POST(makeCreditRequest({ action: "grant", amount: 100 }), routeContext);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { message: "Gecerli bir idempotencyKey gereklidir", code: "invalid-idempotency-key" },
    });
  });

  it("rejects oversized credit mutations", async () => {
    authMocks.requireAdmin.mockResolvedValue({ uid: "admin-1", email: "admin@archilya.com" });

    const response = await POST(makeCreditRequest({ action: "grant", amount: 1_000_001, idempotencyKey: "valid_key_123" }), routeContext);

    expect(response.status).toBe(400);
  });

  it("uses the database RPC for an atomic idempotent credit grant", async () => {
    authMocks.requireAdmin.mockResolvedValue({ uid: "admin-1", email: "admin@archilya.com" });

    const response = await POST(
      makeCreditRequest({ action: "grant", amount: 100, description: "manual grant", idempotencyKey: "valid_key_123" }),
      routeContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { success: true, balanceAfter: 250, transactionId: "tx-1", alreadyApplied: false },
    });
    expect(authMocks.rpc).toHaveBeenCalledWith("refund_user_credits", {
      p_user_id: "user-1",
      p_amount: 100,
      p_description: "manual grant",
      p_idempotency_key: "admin:admin-1:user-1:grant:valid_key_123",
      p_metadata: {
        source: "admin_panel",
        actorId: "admin-1",
        actorEmail: "admin@archilya.com",
        action: "grant",
      },
    });
    expect(authMocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { rpc: authMocks.rpc },
      expect.objectContaining({
        actorId: "admin-1",
        action: "credits_grant",
        resourceId: "user-1",
      }),
    );
  });

  it("maps database insufficient-credit errors for deductions", async () => {
    authMocks.requireAdmin.mockResolvedValue({ uid: "admin-1", email: "admin@archilya.com" });
    authMocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "insufficient credits" } });

    const response = await POST(
      makeCreditRequest({ action: "deduct", amount: 100, idempotencyKey: "valid_key_123" }),
      routeContext,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { message: "Kullanici bu kadar krediye sahip degil", code: "insufficient-credits" },
    });
    expect(authMocks.rpc).toHaveBeenCalledWith("charge_user_credits", expect.objectContaining({
      p_idempotency_key: "admin:admin-1:user-1:deduct:valid_key_123",
    }));
    expect(authMocks.writeAdminAuditLog).not.toHaveBeenCalled();
  });
});
