import { Toaster } from "react-hot-toast";

import AdminShell from "@/components/layout/admin-shell";
import { AdminAuthGuard } from "@/components/auth/admin-auth-guard";
import { AdminAuthProvider } from "@/components/auth/admin-auth-provider";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminSession();

  return (
    <AdminAuthProvider>
      <AdminAuthGuard>
        <AdminShell>
          {children}
        </AdminShell>
      </AdminAuthGuard>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a1c23",
            color: "#e2e2e2",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: 0,
            fontSize: "14px",
            fontFamily: "var(--font-montserrat), sans-serif",
          },
          success: {
            iconTheme: {
              primary: "#c6a87c",
              secondary: "#1a1c23",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#1a1c23",
            },
          },
        }}
      />
    </AdminAuthProvider>
  );
}
