// @vitest-environment jsdom

import { useEffect } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    updateUser: vi.fn(),
  },
  createClient: vi.fn(() => ({ auth: supabaseMocks.auth })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: supabaseMocks.createClient,
}));

vi.mock("@/lib/analytics/events", () => ({
  logLoginEvent: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() })),
}));

import { AuthProvider, useAuth } from "@/components/providers/auth-provider";

type AuthValue = ReturnType<typeof useAuth>;

function AuthValueProbe({ onValue }: { onValue: (value: AuthValue) => void }) {
  const value = useAuth();
  useEffect(() => { onValue(value); }, [onValue, value]);
  return null;
}

async function renderAuthProvider() {
  let authValue: AuthValue | undefined;
  render(
    <AuthProvider>
      <AuthValueProbe onValue={(value) => { authValue = value; }} />
    </AuthProvider>,
  );
  await waitFor(() => expect(authValue).toBeDefined());
  return authValue as AuthValue;
}

describe("AuthProvider updateUserPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    supabaseMocks.auth.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("rejects weak passwords before updating", async () => {
    const authValue = await renderAuthProvider();
    await expect(authValue.updateUserPassword("current-password", "weak")).rejects.toThrow(
      "Şifre en az 8 karakter olmalı; en az 1 büyük harf, 1 küçük harf, 1 rakam ve 1 özel karakter içermelidir.",
    );
    expect(supabaseMocks.auth.updateUser).not.toHaveBeenCalled();
  });

  it("updates password for valid passwords", async () => {
    supabaseMocks.auth.updateUser.mockResolvedValue({ data: { user: null }, error: null });
    const authValue = await renderAuthProvider();

    await act(async () => {
      await authValue.updateUserPassword("current-password", "Abcdef12!");
    });

    expect(supabaseMocks.auth.updateUser).toHaveBeenCalledWith({ password: "Abcdef12!" });
  });
});
