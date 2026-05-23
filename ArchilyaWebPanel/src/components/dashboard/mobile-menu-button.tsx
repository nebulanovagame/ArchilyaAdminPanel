"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDashboardShell } from "./dashboard-shell-provider";

export default function MobileMenuButton() {
  const { openMobileDrawer } = useDashboardShell();
  const t = useTranslations("dashboard.sidebar");

  return (
    <button
      onClick={openMobileDrawer}
      aria-label={t("openMenu")}
      className="md:hidden text-gray-500 hover:text-white transition-colors"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}
