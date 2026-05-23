"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

type ShellContextValue = {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  mobileDrawerOpen: boolean;
  openMobileDrawer: () => void;
  closeMobileDrawer: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function DashboardShellProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleSidebar = useCallback(
    () => setSidebarOpen((prev) => !prev),
    [],
  );
  const openMobileDrawer = useCallback(
    () => setMobileDrawerOpen(true),
    [],
  );
  const closeMobileDrawer = useCallback(
    () => setMobileDrawerOpen(false),
    [],
  );

  const value = useMemo(
    () => ({
      sidebarOpen,
      toggleSidebar,
      mobileDrawerOpen,
      openMobileDrawer,
      closeMobileDrawer,
    }),
    [sidebarOpen, mobileDrawerOpen, toggleSidebar, openMobileDrawer, closeMobileDrawer],
  );

  return (
    <ShellContext.Provider value={value}>
      {children}
    </ShellContext.Provider>
  );
}

export function useDashboardShell() {
  const context = useContext(ShellContext);

  if (!context) {
    throw new Error(
      "useDashboardShell must be used within a DashboardShellProvider.",
    );
  }

  return context;
}
