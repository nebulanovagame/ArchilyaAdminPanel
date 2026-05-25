import { Suspense } from "react";
import { DashboardShellProvider } from "./dashboard-shell-provider";
import Sidebar from "./sidebar";
import MobileDrawer from "./mobile-drawer";
import Header from "./header";
import KeyboardShortcutsHandler from "@/components/keyboard-shortcuts-handler";
import type { UserDisplayData } from "@/lib/auth/user-display";

export default function DashboardShell({
  children,
  sessionUser,
}: {
  children: React.ReactNode;
  sessionUser: UserDisplayData;
}) {
  return (
    <DashboardShellProvider>
      <KeyboardShortcutsHandler />
      <div className="min-h-screen bg-background text-white flex">
        {/* Desktop sidebar — client, consumes provider */}
        <Sidebar sessionUser={sessionUser} />

        {/* Mobile drawer — client, consumes provider */}
        <MobileDrawer sessionUser={sessionUser} />

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header — server, renders client islands for interactivity */}
          <Header sessionUser={sessionUser} />

          <main className="flex-1 overflow-y-auto">
            <Suspense fallback={null}>{children}</Suspense>
          </main>
        </div>
      </div>
    </DashboardShellProvider>
  );
}
