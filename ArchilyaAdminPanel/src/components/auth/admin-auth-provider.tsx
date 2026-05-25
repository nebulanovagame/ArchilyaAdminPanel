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
import { setAccessToken } from "@/lib/api/admin-client";

type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type AdminAuthContextValue = {
  currentUser: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function mapUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    avatar_url?: string | null;
    picture?: string | null;
  } | null;
} | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName: user.user_metadata?.name ?? null,
    avatarUrl:
      user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
  };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setCurrentUser(mapUser(session?.user ?? null));
      setAccessToken(session?.access_token ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setCurrentUser(mapUser(session?.user ?? null));
        setAccessToken(session?.access_token ?? null);
        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    },
    [supabase],
  );

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAccessToken(null);
    router.refresh();
  }, [supabase, router]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({ currentUser, loading, login, logout }),
    [currentUser, loading, login, logout],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider.");
  }
  return context;
}
