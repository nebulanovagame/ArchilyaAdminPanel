"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

/**
 * Client-side guard that prevents users with an active password-recovery
 * session from accessing the dashboard before setting a new password.
 *
 * Must be rendered inside an AuthProvider.
 */
export function RecoveryGuard() {
  const { isRecoveryMode, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isRecoveryMode) {
      router.replace("/sifre-sifirla");
    }
  }, [isRecoveryMode, loading, router]);

  // Render nothing — purely a side-effect guard
  return null;
}
