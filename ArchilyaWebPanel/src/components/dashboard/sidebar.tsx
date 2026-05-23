"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronRight, Download, LogOut, Globe } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

import { NAV_ITEMS } from "./nav-items";
import { useAuth } from "@/components/providers/auth-provider";
import { useDashboardShell } from "./dashboard-shell-provider";
import {
  getUserDisplayName,
  getUserInitial,
  type UserDisplayData,
} from "@/lib/auth/user-display";
import { getFirebaseAuthErrorMessage } from "@/lib/firebase/auth-errors";
import { Logo } from "@/components/brand/logo";

interface SidebarProps {
  sessionUser: UserDisplayData;
}

export default function Sidebar({ sessionUser }: SidebarProps) {
  const t = useTranslations();
  const { sidebarOpen, toggleSidebar } = useDashboardShell();
  const isCollapsed = !sidebarOpen;
  const onToggle = toggleSidebar;
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const userDisplayName = getUserDisplayName(sessionUser);
  const userInitial = getUserInitial(sessionUser);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Check if already installed (standalone display mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      const timeoutId = window.setTimeout(() => setIsInstalled(true), 0);
      return () => {
        window.clearTimeout(timeoutId);
        window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installPrompt) {
      toast.error(t("dashboard.sidebar.installUnsupported"));
      return;
    }
    const result = await installPrompt.prompt();
    if (result.outcome === "accepted") {
      toast.success(t("dashboard.sidebar.installSuccess"));
      setInstallPrompt(null);
    } else {
      toast(t("dashboard.sidebar.installCancelled"));
    }
  }, [installPrompt, t]);

  async function handleLogout() {
    try {
      setLogoutLoading(true);
      await logout();
      router.replace("/giris");
      router.refresh();
    } catch (error) {
      toast.error(getFirebaseAuthErrorMessage(error));
    } finally {
      setLogoutLoading(false);
    }
  }

  async function toggleLocale() {
    const current = document.documentElement.lang || "tr";
    const next = current === "tr" ? "en" : "tr";
    document.cookie = `archilya-locale=${next};path=/;max-age=31536000`;
    router.refresh();
  }

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href;
  }

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="hidden md:flex flex-col bg-[#0a0c0f] border-r border-white/5 flex-shrink-0 overflow-hidden relative z-30"
    >
      <div className="flex flex-col h-full min-w-0">
        {/* Logo */}
        <div
          className={`flex items-center gap-3 px-6 py-6 border-b border-white/5 ${
            isCollapsed ? "justify-center px-4" : ""
          }`}
        >
          <Link href="/" className="flex flex-col flex-shrink-0">
            <Logo collapsed={isCollapsed} />
          </Link>
          <button
            onClick={onToggle}
            aria-label={isCollapsed ? t("dashboard.sidebar.expandMenu") : t("dashboard.sidebar.collapseMenu")}
            aria-expanded={!isCollapsed}
            className="ml-auto text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform ${
                isCollapsed ? "" : "rotate-180"
              }`}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            const sharedClasses = `w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-200 group relative
              ${
                active
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-gray-500 hover:text-gray-200 hover:bg-white/5 border border-transparent"
              }
              ${isCollapsed ? "justify-center" : ""}
            `;

            const inner = (
              <>
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    active ? "text-primary" : ""
                  }`}
                />

                {!isCollapsed && (
                  <>
                    <span className="text-xs font-sans font-medium uppercase tracking-widest flex-1 text-left">
                      {t(item.labelKey)}
                    </span>
                    {item.badge && (
                      <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                        {t(item.badge)}
                      </span>
                    )}
                  </>
                )}

                {/* Tooltip when collapsed */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-2 py-1 bg-[#1a1c23] border border-white/10 rounded-sm text-xs font-sans text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {t(item.labelKey)}
                  </div>
                )}
              </>
            );

            return item.disabled ? (
              <button key={item.labelKey} type="button" className={sharedClasses}>
                {inner}
              </button>
            ) : (
              <Link key={item.labelKey} href={item.href} className={sharedClasses}>
                {inner}
              </Link>
            );
          })}
        </nav>

        {/* Install PWA button */}
        {!isCollapsed && !isInstalled && (
          <div className="px-3 py-4 border-t border-white/5">
            <button
              type="button"
              onClick={handleInstall}
              className="w-full flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-black rounded-sm transition-all duration-300 group cursor-pointer"
            >
              <Download className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-sans font-bold uppercase tracking-widest">
                {t("common.desktopApp")}
              </span>
            </button>
          </div>
        )}

        {/* Locale toggle */}
        {!isCollapsed && (
          <div className="px-3 py-2 border-t border-white/5">
            <button
              type="button"
              onClick={toggleLocale}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-sm text-gray-500 hover:text-gray-200 hover:bg-white/5 transition-all text-xs font-sans uppercase tracking-widest"
            >
              <Globe className="w-4 h-4" />
              <span>{t("dashboard.header.dashboard") === "Dashboard" ? t("dashboard.sidebar.switchToTurkish") : t("dashboard.sidebar.switchToEnglish")}</span>
            </button>
          </div>
        )}

        {/* User */}
        <div className="border-t border-white/5">
          <div
            className={`flex items-center gap-3 p-3 ${
              isCollapsed ? "justify-center" : "px-3 pt-3 pb-1"
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
              {userInitial}
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-sans font-medium text-white truncate">
                  {userDisplayName}
                </p>
                <p className="text-[10px] font-sans text-gray-600 truncate">
                  {sessionUser.email ?? t("common.emailUnavailable")}
                </p>
              </div>
            )}
          </div>

          {/* Logout */}
          {isCollapsed ? (
            <div className="flex justify-center pb-3">
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutLoading}
                aria-label={logoutLoading ? t("dashboard.sidebar.loggingOutAria") : t("dashboard.sidebar.logoutAria")}
                className="w-8 h-8 flex items-center justify-center rounded-sm text-gray-600 hover:text-red-400 hover:bg-white/5 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="px-3 pb-3">
              <button
                type="button"
                onClick={handleLogout}
                disabled={logoutLoading}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-gray-600 hover:text-red-400 hover:bg-white/5 transition-all text-xs font-sans uppercase tracking-widest"
              >
                <LogOut className="w-4 h-4" />
                <span>{logoutLoading ? t("header.loggingOut") : t("header.logout")}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
