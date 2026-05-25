import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
}));
vi.mock("@/lib/auth/redirect", () => ({
  buildAuthRedirectHref: vi.fn((_path?: string) => "/giris?from=%2F"),
  PANEL_LAST_PATH_COOKIE_NAME: "archilya_panel_last_path",
}));

const supabaseMocks = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: supabaseMocks.auth })),
}));

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  getSessionCookieValue,
  getOptionalSessionUser,
  requireSessionUser,
} from "@/lib/auth/session";

describe("session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getOptionalSessionUser", () => {
    it("returns null when no user is authenticated", async () => {
      supabaseMocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("no session") });

      const user = await getOptionalSessionUser();
      expect(user).toBeNull();
    });

    it("returns mapped user for authenticated Supabase user", async () => {
      supabaseMocks.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: "user-456",
            email: "valid@example.com",
            user_metadata: { name: "Valid User", avatar_url: "https://example.com/valid.png" },
            email_confirmed_at: "2024-01-01T00:00:00Z",
          },
        },
        error: null,
      });

      const user = await getOptionalSessionUser();
      expect(user).toEqual({
        uid: "user-456",
        email: "valid@example.com",
        name: "Valid User",
        picture: "https://example.com/valid.png",
        emailVerified: true,
      });
    });
  });

  describe("requireSessionUser", () => {
    it("returns user when session exists", async () => {
      supabaseMocks.auth.getUser.mockResolvedValue({
        data: {
          user: {
            id: "user-999",
            email: "required@example.com",
            user_metadata: { name: "Required User" },
            email_confirmed_at: null,
          },
        },
        error: null,
      });

      const user = await requireSessionUser();
      expect(user?.uid).toBe("user-999");
    });

    it("redirects to auth when no session", async () => {
      supabaseMocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error("no session") });
      vi.mocked(cookies).mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) } as never);

      await expect(requireSessionUser()).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalled();
    });
  });

  describe("getSessionCookieValue", () => {
    it("returns cookie value when present", async () => {
      const mockCookieStore = { get: vi.fn().mockReturnValue({ value: "session-value-123" }) };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      const value = await getSessionCookieValue();
      expect(value).toBe("session-value-123");
    });

    it("returns empty string when cookie is missing", async () => {
      const mockCookieStore = { get: vi.fn().mockReturnValue(undefined) };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      const value = await getSessionCookieValue();
      expect(value).toBe("");
    });
  });
});
