import {
  LayoutDashboard,
  Users,
  Sparkles,
  Layers,
  CreditCard,
  Trash2,
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
  { icon: Users, labelKey: "dashboard.sidebar.team", href: "/ekip" },
  { icon: Sparkles, labelKey: "dashboard.sidebar.aiStudio", href: "/ai-studio", badge: "common.beta" },
  { icon: Layers, labelKey: "dashboard.sidebar.archilyaRender", href: "/archilya-render" },
  { icon: CreditCard, labelKey: "dashboard.sidebar.subscription", href: "/abonelik" },
  { icon: Trash2, labelKey: "dashboard.sidebar.trash", href: "/cop-kutusu" },
  { icon: Settings, labelKey: "dashboard.sidebar.settings", href: "/ayarlar" },
];
