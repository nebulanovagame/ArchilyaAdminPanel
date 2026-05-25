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

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { logLoginEvent } from "@/lib/analytics/events";

type AuthUser = {
  uid: string;
  email: string | null;
  name: string | null;
  displayName: string | null;
  picture: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerData: Array<{ providerId: string }>;
};

const RECOVERY_FLAG_KEY = "archilya:password-recovery";

type AuthContextValue = {
  currentUser: AuthUser | null;
  loading: boolean;
  signup: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  googleSignIn: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  updateUserEmail: (nextEmail: string, currentPassword?: string) => Promise<void>;
  updateUserPassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  deleteUserAccount: (currentPassword?: string) => Promise<void>;
  isRecoveryMode: boolean;
  completePasswordReset: (newPassword: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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

function mapUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
  } | null;
  app_metadata?: {
    provider?: string | null;
    providers?: string[] | null;
  } | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
} | null): AuthUser | null {
  if (!user) return null;
  const providers = user.app_metadata?.providers?.length
    ? user.app_metadata.providers
    : [user.app_metadata?.provider || "password"].filter(Boolean);
  const name = user.user_metadata?.name ?? null;
  const picture = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;
  return {
    uid: user.id,
    email: user.email ?? null,
    name,
    displayName: name,
    picture,
    photoURL: picture,
    emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
    providerData: providers.map((providerId) => ({ providerId })),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(RECOVERY_FLAG_KEY) === "true";
  });
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setCurrentUser(mapUser(session?.user ?? null));
      // Check if we have a session AND recovery flag is set
      if (session && sessionStorage.getItem(RECOVERY_FLAG_KEY) === "true") {
        setIsRecoveryMode(true);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setCurrentUser(mapUser(session?.user ?? null));
        setLoading(false);

        if (event === "PASSWORD_RECOVERY") {
          sessionStorage.setItem(RECOVERY_FLAG_KEY, "true");
          setIsRecoveryMode(true);
        }
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      validatePasswordPolicy(password);

      // Use server-side signup endpoint to bypass email confirmation.
      // The admin API creates the user with email_confirm: true so
      // no verification email is needed.
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Kayıt oluşturulamadı.");
      }

      // After server-side creation, sign in on the client to obtain a session.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      logLoginEvent("email_signup");
    },
    [supabase],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Email not confirmed — tell user to check their inbox.
        // Supabase Auth sends a confirmation email via Resend SMTP.
        const lowerMessage = error.message.toLowerCase();
        if (lowerMessage.includes("email not confirmed")) {
          throw new Error(
            "E-posta adresiniz henüz onaylanmamış. Lütfen kayıt sırasında gönderilen onay bağlantısına tıklayın. E-postayı görmüyorsanız spam klasörünü kontrol edin.",
          );
        }

        throw error;
      }

      logLoginEvent("email_login");
    },
    [supabase],
  );

  const googleSignIn = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      throw error;
    }

    // Note: logLoginEvent for Google OAuth is handled in the
    // auth state change callback since the page redirects away.
  }, [supabase]);

  const resetPassword = useCallback(
    async (email: string) => {
      // Set flag BEFORE calling Supabase so it persists across the redirect
      sessionStorage.setItem(RECOVERY_FLAG_KEY, "true");

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/sifre-sifirla`,
      });

      if (error) {
        // Clean up flag on error
        sessionStorage.removeItem(RECOVERY_FLAG_KEY);
        throw error;
      }
    },
    [supabase],
  );

  const completePasswordReset = useCallback(
    async (newPassword: string) => {
      validatePasswordPolicy(newPassword);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Clear recovery state
      setIsRecoveryMode(false);
      sessionStorage.removeItem(RECOVERY_FLAG_KEY);
    },
    [supabase],
  );

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      const { error } = await supabase.auth.updateUser({
        data: { name: displayName.trim() },
      });

      if (error) {
        throw error;
      }
    },
    [supabase],
  );

  const updateUserEmail = useCallback(
    async (nextEmail: string) => {
      const { error } = await supabase.auth.updateUser({
        email: nextEmail.trim(),
      });

      if (error) {
        throw error;
      }
    },
    [supabase],
  );

  const updateUserPassword = useCallback(
    async (_currentPassword: string, nextPassword: string) => {
      validatePasswordPolicy(nextPassword);
      const { error } = await supabase.auth.updateUser({
        password: nextPassword,
      });

      if (error) {
        throw error;
      }
    },
    [supabase],
  );

  const deleteUserAccount = useCallback(async () => {
    // Account deletion requires server-side admin privileges.
    // For now we sign the user out; a dedicated API route will handle full deletion.
    await supabase.auth.signOut();
  }, [supabase]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    router.refresh();
  }, [supabase, router]);

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
      isRecoveryMode: isRecoveryMode,
      completePasswordReset,
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
      isRecoveryMode,
      completePasswordReset,
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
