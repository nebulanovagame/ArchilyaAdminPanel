import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock server-only before importing session
vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth/redirect", () => ({
  buildAuthRedirectHref: vi.fn((_path?: string) => "/giris?from=%2F"),
  PANEL_LAST_PATH_COOKIE_NAME: "archilya_panel_last_path",
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    createRemoteJWKSet: vi.fn().mockReturnValue("mock-jwks"),
  };
});

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";

import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  getSessionCookieValue,
  getOptionalSessionUser,
  requireSessionUser,
  verifyFirebaseIdToken,
  createSessionCookieValue,
} from "@/lib/auth/session";

const MOCK_SECRET = "test-secret-for-unit-tests-only-must-be-32-chars!!";

describe("session", () => {
  beforeEach(() => {
    vi.stubEnv("PANEL_SESSION_SECRET", MOCK_SECRET);
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "test-project");
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("verifyFirebaseIdToken", () => {
    it("throws when payload has no sub", async () => {
      vi.spyOn(await import("jose"), "jwtVerify").mockResolvedValueOnce({
        payload: {},
        protectedHeader: { alg: "RS256" },
      } as never);

      await expect(verifyFirebaseIdToken("fake-id-token")).rejects.toThrow(
        "Firebase ID token geçersiz."
      );
    });

    it("returns mapped user for valid token", async () => {
      vi.spyOn(await import("jose"), "jwtVerify").mockResolvedValueOnce({
        payload: {
          sub: "user-123",
          email: "test@example.com",
          name: "Test User",
          picture: "https://example.com/pic.png",
          email_verified: true,
        },
        protectedHeader: { alg: "RS256" },
      } as never);

      const user = await verifyFirebaseIdToken("valid-token");
      expect(user).toEqual({
        uid: "user-123",
        email: "test@example.com",
        name: "Test User",
        picture: "https://example.com/pic.png",
        emailVerified: true,
      });
    });
  });

  describe("createSessionCookieValue", () => {
    it("throws when PANEL_SESSION_SECRET is missing", async () => {
      vi.unstubAllEnvs();
      // Also need to mock jwtVerify so verifyFirebaseIdToken doesn't fail first
      vi.spyOn(await import("jose"), "jwtVerify").mockResolvedValueOnce({
        payload: { sub: "user-123" },
        protectedHeader: { alg: "RS256" },
      } as never);

      await expect(
        createSessionCookieValue("any-token")
      ).rejects.toThrow("PANEL_SESSION_SECRET");
    });

    it("returns a signed JWT string", async () => {
      vi.spyOn(await import("jose"), "jwtVerify").mockResolvedValueOnce({
        payload: {
          sub: "user-123",
          email: "test@example.com",
          name: "Test User",
          picture: null,
          email_verified: false,
        },
        protectedHeader: { alg: "RS256" },
      } as never);

      const cookieValue = await createSessionCookieValue("valid-id-token");
      expect(typeof cookieValue).toBe("string");
      expect(cookieValue.length).toBeGreaterThan(0);
    });
  });

  describe("getSessionCookieValue", () => {
    it("returns cookie value when present", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: "session-value-123" }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      const value = await getSessionCookieValue();
      expect(value).toBe("session-value-123");
      expect(mockCookieStore.get).toHaveBeenCalledWith(SESSION_COOKIE_NAME);
    });

    it("returns empty string when cookie is missing", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue(undefined),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      const value = await getSessionCookieValue();
      expect(value).toBe("");
    });
  });

  describe("getOptionalSessionUser", () => {
    it("returns null when no cookie exists", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue(undefined),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      const user = await getOptionalSessionUser();
      expect(user).toBeNull();
    });

    it("returns null for invalid JWT", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: "invalid-jwt" }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      const user = await getOptionalSessionUser();
      expect(user).toBeNull();
    });

    it("returns mapped user for valid session cookie", async () => {
      vi.spyOn(await import("jose"), "jwtVerify").mockResolvedValueOnce({
        payload: {
          type: "archilya-panel-session",
          uid: "user-456",
          email: "valid@example.com",
          name: "Valid User",
          picture: "https://example.com/valid.png",
          emailVerified: true,
        },
        protectedHeader: { alg: "HS256" },
      } as never);

      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: "valid-session-token" }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      const user = await getOptionalSessionUser();
      expect(user).toEqual({
        uid: "user-456",
        email: "valid@example.com",
        name: "Valid User",
        picture: "https://example.com/valid.png",
        emailVerified: true,
      });
    });

    it("returns null for wrong session type", async () => {
      const token = await new SignJWT({
        type: "wrong-type",
        uid: "user-789",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer("archilya-panel")
        .setAudience("archilya-panel-user")
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(MOCK_SECRET));

      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: token }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      const user = await getOptionalSessionUser();
      expect(user).toBeNull();
    });
  });

  describe("requireSessionUser", () => {
    it("returns user when session exists", async () => {
      vi.spyOn(await import("jose"), "jwtVerify").mockResolvedValueOnce({
        payload: {
          type: "archilya-panel-session",
          uid: "user-999",
          email: "required@example.com",
          name: "Required User",
          picture: null,
          emailVerified: false,
        },
        protectedHeader: { alg: "HS256" },
      } as never);

      const mockCookieStore = {
        get: vi.fn().mockReturnValue({ value: "valid-session-token" }),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      const user = await requireSessionUser();
      expect(user?.uid).toBe("user-999");
    });

    it("redirects to auth when no session", async () => {
      const mockCookieStore = {
        get: vi.fn().mockReturnValue(undefined),
      };
      vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);

      await expect(requireSessionUser()).rejects.toThrow("NEXT_REDIRECT");
      expect(redirect).toHaveBeenCalled();
    });
  });
});
