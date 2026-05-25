"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, LogOut } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

import { NAV_ITEMS } from "./nav-items";
import { useAuth } from "@/components/providers/auth-provider";
import { useDashboardShell } from "./dashboard-shell-provider";
import {
  getUserDisplayName,
  getUserInitial,
  type UserDisplayData,
} from "@/lib/auth/user-display";
import { getSupabaseAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { Logo } from "@/components/brand/logo";

interface MobileDrawerProps {
  sessionUser: UserDisplayData;
}

export default function MobileDrawer({ sessionUser }: MobileDrawerProps) {
  const t = useTranslations();
  const { mobileDrawerOpen: isOpen, closeMobileDrawer: onClose } =
    useDashboardShell();
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const userDisplayName = getUserDisplayName(sessionUser);
  const userInitial = getUserInitial(sessionUser);

  async function handleLogout() {
    try {
      setLogoutLoading(true);
      await logout();
      onClose();
      router.replace("/giris");
      router.refresh();
    } catch (error) {
      toast.error(getSupabaseAuthErrorMessage(error));
    } finally {
      setLogoutLoading(false);
    }
  }

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 bottom-0 w-64 bg-[#0a0c0f] border-r border-white/5 z-50 md:hidden flex flex-col"
          >
            <div className="absolute top-4 right-4">
              <button
                onClick={onClose}
                aria-label={t("dashboard.sidebar.closeMenu")}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col h-full">
              {/* Logo */}
              <div className="px-6 py-6 border-b border-white/5">
                <Link href="/" onClick={onClose} className="flex flex-col">
                  <Logo />
                </Link>
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
                  `;

                  const inner = (
                    <>
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 ${
                          active ? "text-primary" : ""
                        }`}
                      />
                      <span className="text-xs font-sans font-medium uppercase tracking-widest flex-1 text-left">
                        {t(item.labelKey)}
                      </span>
                      {item.badge && (
                        <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          {t(item.badge)}
                        </span>
                      )}
                    </>
                  );

                  return item.disabled ? (
                    <button key={item.labelKey} type="button" onClick={onClose} className={sharedClasses}>
                      {inner}
                    </button>
                  ) : (
                    <Link key={item.labelKey} href={item.href} onClick={onClose} className={sharedClasses}>
                      {inner}
                    </Link>
                  );
                })}
              </nav>

              {/* Download button */}
              <div className="px-3 py-4 border-t border-white/5">
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-primary/10 border border-primary/20 text-primary hover:bg-primary hover:text-black rounded-sm transition-all duration-300 group cursor-pointer"
                >
                  <Download className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs font-sans font-bold uppercase tracking-widest">
                    {t("common.desktopApp")}
                  </span>
                </button>
              </div>

              {/* User */}
              <div className="border-t border-white/5 px-3 pt-3 pb-1">
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
                    {userInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-sans font-medium text-white truncate">
                      {userDisplayName}
                    </p>
                    <p className="text-[10px] font-sans text-gray-600 truncate">
                      {sessionUser.email ?? t("common.emailUnavailable")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Logout */}
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
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
