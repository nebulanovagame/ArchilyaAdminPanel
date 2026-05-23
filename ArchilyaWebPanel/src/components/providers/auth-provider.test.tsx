// @vitest-environment jsdom

import { useEffect } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => {
  const mockUser = {
    email: "user@example.com",
    providerData: [{ providerId: "password" }],
    reload: vi.fn(),
    getIdToken: vi.fn(),
  };

  return {
    mockUser,
    mockAuth: { currentUser: mockUser },
    credentialValue: { providerId: "password" },
    unsubscribe: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    deleteUser: vi.fn(),
    credential: vi.fn(),
    onAuthStateChanged: vi.fn(),
    reauthenticateWithCredential: vi.fn(),
    reauthenticateWithPopup: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    updatePassword: vi.fn(),
    updateProfile: vi.fn(),
    verifyBeforeUpdateEmail: vi.fn(),
    getFirebaseAuth: vi.fn(),
    getGoogleProvider: vi.fn(),
  };
});

vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: authMocks.createUserWithEmailAndPassword,
  deleteUser: authMocks.deleteUser,
  EmailAuthProvider: {
    credential: authMocks.credential,
  },
  onAuthStateChanged: authMocks.onAuthStateChanged,
  reauthenticateWithCredential: authMocks.reauthenticateWithCredential,
  reauthenticateWithPopup: authMocks.reauthenticateWithPopup,
  sendPasswordResetEmail: authMocks.sendPasswordResetEmail,
  signInWithEmailAndPassword: authMocks.signInWithEmailAndPassword,
  signInWithPopup: authMocks.signInWithPopup,
  signOut: authMocks.signOut,
  updatePassword: authMocks.updatePassword,
  updateProfile: authMocks.updateProfile,
  verifyBeforeUpdateEmail: authMocks.verifyBeforeUpdateEmail,
}));

vi.mock("@/lib/firebase/client", () => ({
  getFirebaseAuth: authMocks.getFirebaseAuth,
  getGoogleProvider: authMocks.getGoogleProvider,
}));

vi.mock("@/lib/analytics/events", () => ({
  logLoginEvent: vi.fn(),
}));

import { AuthProvider, useAuth } from "@/components/providers/auth-provider";

type AuthValue = ReturnType<typeof useAuth>;

function AuthValueProbe({ onValue }: { onValue: (value: AuthValue) => void }) {
  const value = useAuth();

  useEffect(() => {
    onValue(value);
  }, [onValue, value]);

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

    authMocks.mockAuth.currentUser = authMocks.mockUser;
    authMocks.mockUser.reload.mockResolvedValue(undefined);
    authMocks.mockUser.getIdToken.mockResolvedValue("id-token");
    authMocks.credential.mockReturnValue(authMocks.credentialValue);
    authMocks.getFirebaseAuth.mockReturnValue(authMocks.mockAuth);
    authMocks.getGoogleProvider.mockReturnValue({ providerId: "google.com" });
    authMocks.onAuthStateChanged.mockImplementation(
      (_auth: unknown, callback: (user: typeof authMocks.mockUser) => void) => {
        callback(authMocks.mockUser);
        return authMocks.unsubscribe;
      },
    );
    authMocks.reauthenticateWithCredential.mockResolvedValue(undefined);
    authMocks.updatePassword.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it("rejects weak passwords before Firebase reauthentication", async () => {
    const authValue = await renderAuthProvider();

    await expect(authValue.updateUserPassword("current-password", "weak")).rejects.toThrow(
      "Şifre en az 8 karakter olmalı; en az 1 büyük harf, 1 küçük harf, 1 rakam ve 1 özel karakter içermelidir.",
    );

    expect(authMocks.credential).not.toHaveBeenCalled();
    expect(authMocks.reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(authMocks.updatePassword).not.toHaveBeenCalled();
  });

  it("reauthenticates and updates Firebase password for valid passwords", async () => {
    const authValue = await renderAuthProvider();

    await act(async () => {
      await authValue.updateUserPassword("current-password", "Abcdef12!");
    });

    expect(authMocks.credential).toHaveBeenCalledWith("user@example.com", "current-password");
    expect(authMocks.reauthenticateWithCredential).toHaveBeenCalledWith(
      authMocks.mockUser,
      authMocks.credentialValue,
    );
    expect(authMocks.updatePassword).toHaveBeenCalledWith(authMocks.mockUser, "Abcdef12!");
  });
});
