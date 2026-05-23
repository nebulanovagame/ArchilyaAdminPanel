import { Toaster } from "react-hot-toast";

import DashboardShell from "@/components/dashboard/dashboard-shell";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { requireSessionUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sessionUser = await requireSessionUser();

  return (
    <WorkspaceProvider>
      <ThemeProvider>
        <DashboardShell sessionUser={sessionUser}>{children}</DashboardShell>
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
      </ThemeProvider>
    </WorkspaceProvider>
  );
}
