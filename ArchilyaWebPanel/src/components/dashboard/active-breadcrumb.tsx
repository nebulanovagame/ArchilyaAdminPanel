"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

function getBreadcrumb(pathname: string) {
  if (pathname === "/") return "overview";
  if (pathname === "/ekip") return "team";
  if (pathname === "/ai-studio") return "aiStudio";
  if (pathname === "/archilya-render") return "archilyaRender";
  if (pathname === "/abonelik") return "subscription";
  if (pathname === "/cop-kutusu") return "trash";
  if (pathname === "/ayarlar") return "settings";
  return "overview";
}

export default function ActiveBreadcrumb() {
  const pathname = usePathname();
  const t = useTranslations("dashboard.sidebar");

  return (
    <span className="text-gray-400 uppercase tracking-widest">
      {t(getBreadcrumb(pathname))}
    </span>
  );
}
