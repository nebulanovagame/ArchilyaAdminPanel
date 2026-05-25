import {
  LayoutDashboard,
  Sparkles,
  CreditCard,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  icon: LucideIcon;
  labelKey: string;
  href: string;
  badge?: string;
  disabled?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, labelKey: "dashboard.sidebar.overview", href: "/" },
  { icon: Sparkles, labelKey: "dashboard.sidebar.aiStudio", href: "/ai-studio", badge: "common.beta" },
  { icon: CreditCard, labelKey: "dashboard.sidebar.subscription", href: "/abonelik" },
  { icon: Settings, labelKey: "dashboard.sidebar.settings", href: "/ayarlar" },
];
