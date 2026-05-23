import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns service health with dev version fallback", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", version: "dev" });
    expect(Date.parse(body.timestamp)).not.toBeNaN();
  });

  it("returns the short Vercel commit SHA when available", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abcdef1234567890");

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "ok", version: "abcdef1" });
  });
});
