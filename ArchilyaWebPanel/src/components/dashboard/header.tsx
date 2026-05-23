import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  Search,
  Home,
} from "lucide-react";

import {
  getUserDisplayName,
  getUserInitial,
  type UserDisplayData,
} from "@/lib/auth/user-display";
import { Logo } from "@/components/brand/logo";

import MobileMenuButton from "./mobile-menu-button";
import ActiveBreadcrumb from "./active-breadcrumb";
import NotificationBell from "./notification-bell";
import CreditPills from "./credit-pills";

export default function Header({
  sessionUser,
}: {
  sessionUser: UserDisplayData;
}) {
  const t = useTranslations();
  const userInitial = getUserInitial(sessionUser);
  const userDisplayName = getUserDisplayName(sessionUser);

  return (
    <header className="h-14 border-b border-white/5 bg-[#0a0c0f]/80 backdrop-blur-md flex items-center px-6 gap-4 sticky top-0 z-20">
      {/* Mobile hamburger — client island */}
      <MobileMenuButton />

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-sans">
        <Logo variant="header" collapsed />
        <ChevronRight className="w-3 h-3 text-gray-700" />
        {/* Pathname-driven breadcrumb text — client island */}
        <ActiveBreadcrumb />
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-3">
        {/* Home */}
        <Link
          href="/"
          className="hidden sm:flex items-center gap-1.5 text-gray-500 hover:text-primary border border-white/8 hover:border-primary/30 px-3 py-1.5 rounded-sm transition-all text-xs font-sans uppercase tracking-widest"
        >
          <Home className="w-3.5 h-3.5" />
          <span className="hidden lg:inline">{t("common.home")}</span>
        </Link>

        {/* Search */}
        <button
          type="button"
          aria-label={t("common.search")}
          disabled
          className="hidden sm:flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 text-gray-500 hover:text-white px-3 py-1.5 rounded-sm transition-all group opacity-60 cursor-not-allowed"
        >
          <Search className="w-3.5 h-3.5 group-hover:text-primary transition-colors" />
          <span className="text-xs font-sans tracking-wide">{t("common.searchPlaceholder")}</span>
          <div className="flex items-center gap-0.5 ml-2 text-[10px] bg-white/5 border border-white/10 px-1.5 rounded-[2px] font-mono text-gray-500">
            <span>⌘</span>
            <span>K</span>
          </div>
        </button>

        {/* Credit pills — client island */}
        <CreditPills />

        {/* Notification bell — client island */}
        <NotificationBell />

        {/* Avatar */}
        <div
          className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-black font-bold text-xs overflow-hidden flex-shrink-0"
          title={userDisplayName}
        >
          {userInitial}
        </div>
      </div>
    </header>
  );
}
