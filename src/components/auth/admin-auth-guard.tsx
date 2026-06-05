"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAdminAuth } from "./admin-auth-provider";
import { getCurrentAdmin } from "@/lib/api/admin-client";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAdminAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      router.replace("/giris");
      return;
    }

    // Try local API route first, then fall back to external Admin API
    const checkAdmin = async () => {
      try {
        // 1. Try local /api/admin/me (checks profiles.is_admin directly)
        const localRes = await fetch("/api/admin/me");
        if (localRes.ok) {
          setIsAdmin(true);
          setChecking(false);
          return;
        }

        // 2. Fall back to external Admin API
        await getCurrentAdmin();
        setIsAdmin(true);
      } catch {
        router.replace("/giris");
      } finally {
        setChecking(false);
      }
    };

    checkAdmin();
  }, [currentUser, loading, router]);

  if (loading || checking) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-xs font-sans text-gray-500 uppercase tracking-widest">Yetki kontrol ediliyor...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;
  return <>{children}</>;
}
