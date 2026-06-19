import { describe, expect, it } from "vitest";

import { rejectCrossSiteMutation } from "./security";

describe("admin mutation origin guard", () => {
  it("allows same-origin mutations", () => {
    const request = new Request("https://admin.archilya.com/api/admin/notifications", {
      method: "POST",
      headers: {
        host: "admin.archilya.com",
        origin: "https://admin.archilya.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(rejectCrossSiteMutation(request)).toBeNull();
  });

  it("rejects cross-site mutations", async () => {
    const request = new Request("https://admin.archilya.com/api/admin/notifications", {
      method: "POST",
      headers: {
        host: "admin.archilya.com",
        origin: "https://attacker.example",
        "x-forwarded-proto": "https",
      },
    });

    const response = rejectCrossSiteMutation(request);

    expect(response?.status).toBe(403);
  });
});
