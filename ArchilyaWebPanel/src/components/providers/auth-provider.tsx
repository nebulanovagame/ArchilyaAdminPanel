"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
  type User,
} from "firebase/auth";

import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase/client";
import { logLoginEvent } from "@/lib/analytics/events";

type AuthContextValue = {
  currentUser: User | null;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  googleSignIn: () => Promise<User>;
  updateDisplayName: (displayName: string) => Promise<User>;
  updateUserEmail: (nextEmail: string, currentPassword: string) => Promise<User>;
  updateUserPassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  deleteUserAccount: (currentPassword?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validatePasswordPolicy(password: string): void {
  const hasMinimumLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecialCharacter = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (
    !hasMinimumLength ||
    !hasUppercase ||
    !hasLowercase ||
    !hasDigit ||
    !hasSpecialCharacter
  ) {
    throw new Error(
      "Şifre en az 8 karakter olmalı; en az 1 büyük harf, 1 küçük harf, 1 rakam ve 1 özel karakter içermelidir.",
    );
  }
}

async function createServerSession(user: User) {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Archilya-Auth-Intent": "session",
    },
    body: JSON.stringify({ idToken }),
  });

  if (response.ok) {
    return;
  }

  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(data?.error || "Panel oturumu başlatılamadı.");
}

async function clearServerSession() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    headers: {
      "X-Archilya-Auth-Intent": "logout",
    },
  });

  if (response.ok) {
    return;
  }

  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(data?.error || "Panel oturumu kapatılamadı.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const withSessionSync = useCallback(async (user: User) => {
    try {
      await createServerSession(user);
      return user;
    } catch (error) {
      await signOut(getFirebaseAuth()).catch(() => undefined);
      throw error;
    }
  }, []);

  const getRequiredUser = useCallback(() => {
    const user = getFirebaseAuth().currentUser;

    if (!user) {
      throw new Error("Oturum bulunamadı.");
    }

    return user;
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Oturum bulunamadı.");
    }

    await user.reload();
    const refreshedUser = auth.currentUser ?? user;
    setCurrentUser(refreshedUser);
    return refreshedUser;
  }, []);

  const reauthenticateCurrentUser = useCallback(
    async (currentPassword?: string) => {
      const user = getRequiredUser();
      const providerIds = user.providerData.map((provider) => provider?.providerId);

      if (providerIds.includes("password")) {
        if (!user.email) {
          throw new Error("Kullanıcı e-posta bilgisi eksik.");
        }

        const credential = EmailAuthProvider.credential(user.email, currentPassword || "");
        await reauthenticateWithCredential(user, credential);
        return user;
      }

      if (providerIds.includes("google.com")) {
        await reauthenticateWithPopup(user, getGoogleProvider());
        return getRequiredUser();
      }

      throw new Error("Bu işlem için desteklenmeyen giriş sağlayıcısı.");
    },
    [getRequiredUser],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const auth = getFirebaseAuth();
      validatePasswordPolicy(password);
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      if (name.trim()) {
        await updateProfile(credential.user, { displayName: name.trim() });
      }

      await credential.user.reload();
      const user = auth.currentUser ?? credential.user;
      logLoginEvent("email_signup");
      return withSessionSync(user);
    },
    [withSessionSync],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email, password);
      logLoginEvent("email_login");
      return withSessionSync(credential.user);
    },
    [withSessionSync],
  );

  const googleSignIn = useCallback(async () => {
    const auth = getFirebaseAuth();
    const credential = await signInWithPopup(auth, getGoogleProvider());
    logLoginEvent("google_login");
    return withSessionSync(credential.user);
  }, [withSessionSync]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
    } catch (error) {
      await sleep(700);

      try {
        await sendPasswordResetEmail(getFirebaseAuth(), email);
      } catch {
        throw error;
      }
    }
  }, []);

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      const user = getRequiredUser();
      const trimmedName = displayName.trim();

      await updateProfile(user, { displayName: trimmedName });
      const refreshedUser = await refreshCurrentUser();
      await createServerSession(refreshedUser);
      return refreshedUser;
    },
    [getRequiredUser, refreshCurrentUser],
  );

  const updateUserEmail = useCallback(
    async (nextEmail: string, currentPassword: string) => {
      const user = await reauthenticateCurrentUser(currentPassword);

      await verifyBeforeUpdateEmail(user, nextEmail.trim());
      return user;
    },
    [reauthenticateCurrentUser],
  );

  const updateUserPassword = useCallback(
    async (currentPassword: string, nextPassword: string) => {
      validatePasswordPolicy(nextPassword);
      const user = await reauthenticateCurrentUser(currentPassword);
      await updatePassword(user, nextPassword);
      await refreshCurrentUser();
    },
    [reauthenticateCurrentUser, refreshCurrentUser],
  );

  const deleteUserAccount = useCallback(
    async (currentPassword?: string) => {
      const user = await reauthenticateCurrentUser(currentPassword);
      await deleteUser(user);
      await clearServerSession().catch(() => undefined);
      await signOut(getFirebaseAuth()).catch(() => undefined);
      setCurrentUser(null);
    },
    [reauthenticateCurrentUser],
  );

  const logout = useCallback(async () => {
    await clearServerSession();

    await signOut(getFirebaseAuth());
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      currentUser,
      loading,
      signup,
      login,
      logout,
      resetPassword,
      googleSignIn,
      updateDisplayName,
      updateUserEmail,
      updateUserPassword,
      deleteUserAccount,
    }),
    [
      currentUser,
      loading,
      signup,
      login,
      logout,
      resetPassword,
      googleSignIn,
      updateDisplayName,
      updateUserEmail,
      updateUserPassword,
      deleteUserAccount,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
