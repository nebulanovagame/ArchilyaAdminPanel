"use client";

import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/components/auth/admin-auth-provider";

function getPageTitle(pathname: string): string {
  const paths: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/users": "Kullanıcılar",
    "/workspaces": "Çalışma Alanları",
    "/projects": "Projeler",
    "/credits": "Krediler",
    "/subscriptions": "Abonelikler",
    "/render-jobs": "Render İşleri",
    "/ai-jobs": "AI İşleri",
    "/teklif-sunum": "Teklif / Sunum",
    "/partner-firms": "Şubeler & İş Ortakları",
    "/franchise-applications": "Franchise Başvuruları",
    "/audit-logs": "Denetim Kaydı",
    "/settings": "Ayarlar",
    "/legacy/products": "Eski Sistem - Ürünler",
    "/legacy/plans": "Eski Sistem - Planlar",
    "/legacy/orders": "Eski Sistem - Siparişler",
    "/legacy/licenses": "Eski Sistem - Lisanslar",
    "/legacy/machines": "Eski Sistem - Makineler",
    "/legacy/launcher-releases": "Eski Sistem - Launcher",
  };

  // Check for dynamic routes
  if (pathname.startsWith("/users/") && pathname !== "/users") {
    return "Kullanıcı Detayı";
  }

  return paths[pathname] || "Admin Panel";
}

export function AdminTopbar() {
  const pathname = usePathname();
  const { currentUser } = useAdminAuth();
  const title = getPageTitle(pathname);

  return (
    <header className="h-14 border-b border-white/5 bg-[#0a0c0f]/80 backdrop-blur-md flex items-center px-6 gap-4 sticky top-0 z-20">
      <div>
        <h2 className="font-serif text-lg text-white italic">{title}</h2>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-black font-bold text-xs overflow-hidden flex-shrink-0">
            {(currentUser?.displayName?.[0] ||
              currentUser?.email?.[0] ||
              "A").toLocaleUpperCase("tr-TR")}
          </div>
          <span className="hidden sm:inline text-xs font-sans text-gray-400">
            {currentUser?.email || ""}
          </span>
        </div>
      </div>
    </header>
  );
}
