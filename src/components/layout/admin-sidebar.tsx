"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  Coins,
  CreditCard,
  Wallet,
  ShieldAlert,
  Image,
  Brain,
  FileText,
  Archive,
  ScrollText,
  Megaphone,
  Settings,
  ChevronRight,
  LogOut,
  Loader2,
  ChevronDown,
  Receipt,
  Store,
  ClipboardList,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useAdminAuth } from "@/components/auth/admin-auth-provider";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  children?: { label: string; href: string }[];
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: Users, label: "Kullanıcılar", href: "/users" },
  { icon: Building2, label: "Workspace" + "ler", href: "/workspaces" },
  { icon: FolderKanban, label: "Projeler", href: "/projects" },
  { icon: Coins, label: "Krediler", href: "/credits" },
  { icon: CreditCard, label: "Abonelikler", href: "/subscriptions" },
  { icon: Wallet, label: "Ödeme Oturumları", href: "/payment-sessions" },
  { icon: ShieldAlert, label: "Ödeme Mutabakatı", href: "/payment-reconciliation" },
  { icon: Receipt, label: "Fatura Yönetimi", href: "/invoices" },
  { icon: Image, label: "Render İşleri", href: "/render-jobs" },
  { icon: Brain, label: "AI İşleri", href: "/ai-jobs" },
  { icon: FileText, label: "Teklif / Sunum", href: "/teklif-sunum" },
  { icon: Store, label: "Şubeler & Ortaklar", href: "/partner-firms" },
  { icon: ClipboardList, label: "Franchise Başvuruları", href: "/franchise-applications" },
  {
    icon: Archive,
    label: "Eski Sistem",
    href: "/legacy/products",
    children: [
      { label: "Ürünler", href: "/legacy/products" },
      { label: "Planlar", href: "/legacy/plans" },
      { label: "Siparişler", href: "/legacy/orders" },
      { label: "Lisanslar", href: "/legacy/licenses" },
      { label: "Makineler", href: "/legacy/machines" },
      { label: "Launcher", href: "/legacy/launcher-releases" },
    ],
  },
  { icon: ScrollText, label: "Denetim Kaydı", href: "/audit-logs" },
  { icon: Megaphone, label: "Bildirimler", href: "/notifications" },
  { icon: Settings, label: "Ayarlar", href: "/settings" },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, logout } = useAdminAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedLegacy, setExpandedLegacy] = useState(
    pathname.startsWith("/legacy"),
  );

  const isActive = useCallback(
    (href: string) => {
      if (href === "/dashboard") return pathname === "/dashboard";
      return pathname.startsWith(href);
    },
    [pathname],
  );

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      router.replace("/giris");
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <aside
      className={`hidden md:flex flex-col bg-[#0a0c0f] border-r border-white/5 flex-shrink-0 overflow-hidden relative z-30 transition-all duration-300 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div className="flex flex-col h-full min-w-0">
        {/* Logo */}
        <div
          className={`flex items-center gap-3 px-6 py-6 border-b border-white/5 ${
            collapsed ? "justify-center px-4" : ""
          }`}
        >
          <Link href="/dashboard" className="flex flex-col flex-shrink-0">
            {collapsed ? (
              <span className="font-serif text-primary text-xl">A</span>
            ) : (
              <>
                <span className="font-serif text-primary text-lg tracking-[0.2em] uppercase leading-tight">
                  Archilya
                </span>
                <span className="font-serif text-[10px] text-primary/60 tracking-[0.3em] uppercase">
                  Admin
                </span>
              </>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform ${
                collapsed ? "" : "rotate-180"
              }`}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            if (item.children) {
              return (
                <div key={item.label}>
                  <button
                    onClick={() => setExpandedLegacy(!expandedLegacy)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-200 group relative text-gray-500 hover:text-gray-200 hover:bg-white/5 border border-transparent ${
                      collapsed ? "justify-center" : ""
                    }`}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="text-xs font-sans font-medium uppercase tracking-widest flex-1 text-left">
                          {item.label}
                        </span>
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            expandedLegacy ? "rotate-180" : ""
                          }`}
                        />
                      </>
                    )}
                  </button>
                  {expandedLegacy && !collapsed && (
                    <div className="ml-6 mt-0.5 space-y-0.5 border-l border-white/5 pl-3">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-3 py-1.5 rounded-sm text-[10px] font-sans uppercase tracking-widest transition-all ${
                            isActive(child.href)
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "text-gray-600 hover:text-gray-300 hover:bg-white/5 border border-transparent"
                          }`}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm transition-all duration-200 group relative ${
                  active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-gray-500 hover:text-gray-200 hover:bg-white/5 border border-transparent"
                } ${collapsed ? "justify-center" : ""}`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 ${
                    active ? "text-primary" : ""
                  }`}
                />
                {!collapsed && (
                  <span className="text-xs font-sans font-medium uppercase tracking-widest flex-1 text-left">
                    {item.label}
                  </span>
                )}
                {collapsed && (
                  <div className="absolute left-full ml-3 px-2 py-1 bg-[#1a1c23] border border-white/10 rounded-sm text-[10px] font-sans text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/5">
          <div
            className={`flex items-center gap-3 p-3 ${
              collapsed ? "justify-center" : "px-3 pt-3 pb-1"
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black font-bold text-sm flex-shrink-0">
              {(currentUser?.displayName?.[0] ||
                currentUser?.email?.[0] ||
                "A").toLocaleUpperCase("tr-TR")}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-sans font-medium text-white truncate">
                  {currentUser?.displayName || "Admin"}
                </p>
                <p className="text-[10px] font-sans text-gray-600 truncate">
                  {currentUser?.email || ""}
                </p>
              </div>
            )}
          </div>

          <div className={collapsed ? "flex justify-center pb-3" : "px-3 pb-3"}>
            <button
              onClick={handleLogout}
              disabled={logoutLoading}
              className={
                collapsed
                  ? "w-8 h-8 flex items-center justify-center rounded-sm text-gray-600 hover:text-red-400 hover:bg-white/5 transition-all"
                  : "w-full flex items-center gap-3 px-3 py-2 rounded-sm text-gray-600 hover:text-red-400 hover:bg-white/5 transition-all text-[10px] font-sans uppercase tracking-widest"
              }
            >
              {logoutLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              {!collapsed && <span>Çıkış Yap</span>}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
