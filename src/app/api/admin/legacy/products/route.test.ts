import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const authMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/auth/admin-guard", () => ({
  requireAdmin: authMocks.requireAdmin,
}));

import { GET } from "./route";

describe("GET /api/admin/legacy/products", () => {
  beforeEach(() => {
    authMocks.requireAdmin.mockReset();
  });

  it("requires admin access", async () => {
    authMocks.requireAdmin.mockResolvedValue(
      NextResponse.json(
        { error: { message: "Oturum gereklidir.", code: "unauthenticated" } },
        { status: 401 },
      ),
    );

    const response = await GET(new Request("https://admin.archilya.com/api/admin/legacy/products"), undefined);

    expect(response.status).toBe(401);
  });

  it("returns legacy data for admins", async () => {
    authMocks.requireAdmin.mockResolvedValue({ uid: "admin-1", email: "admin@archilya.com" });

    const response = await GET(new Request("https://admin.archilya.com/api/admin/legacy/products"), undefined);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ data: [] });
  });
});
