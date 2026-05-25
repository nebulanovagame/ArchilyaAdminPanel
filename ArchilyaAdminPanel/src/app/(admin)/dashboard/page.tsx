"use client";

import { useEffect, useState } from "react";
import { Users, Building2, Coins, CreditCard, Image, Activity } from "lucide-react";
import { Card, CardHeader, CardTitle, CardValue, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { getDashboardStats } from "@/lib/api/admin-client";
import type { DashboardStats } from "@/lib/api/types";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "danger"> = {
  healthy: "success",
  degraded: "warning",
  down: "danger",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Dashboard yukleniyor..." />;

  if (error) {
    return (
      <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  const cards = [
    { title: "Toplam Kullanici", value: stats?.totalUsers.toLocaleString("tr-TR") || "0", desc: "Sistemde kayitli toplam hesap", icon: Users },
    { title: "Aktif Workspace", value: stats?.activeWorkspaces.toLocaleString("tr-TR") || "0", desc: "Aktif calisma alanlari", icon: Building2 },
    { title: "Toplam Kredi", value: stats?.totalCreditUsage.toLocaleString("tr-TR") || "0", desc: "Kullanilabilir kredi bakiyesi", icon: Coins },
    { title: "Aktif Abonelik", value: stats?.activeSubscriptions.toLocaleString("tr-TR") || "0", desc: "Aktif odeme planlari", icon: CreditCard },
    { title: "Bekleyen Render", value: stats?.pendingRenderJobs.toLocaleString("tr-TR") || "0", desc: "Kuyrukta bekleyen isler", icon: Image },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-white italic">Dashboard</h1>
        {stats?.systemStatus && (
          <Badge variant={STATUS_VARIANTS[stats.systemStatus] || "success"}>
            <Activity className="w-3 h-3 mr-1.5" />
            Sistem: {stats.systemStatus}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} hover>
              <CardHeader className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.desc}</CardDescription>
                </div>
                <div className="rounded-sm border border-primary/20 bg-primary/10 p-2.5 text-primary">
                  <Icon className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardValue className="text-3xl">{card.value}</CardValue>
            </Card>
          );
        })}

        <Card hover>
          <CardHeader className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Sistem Durumu</CardTitle>
              <CardDescription>Servis sagligi</CardDescription>
            </div>
            <div className="rounded-sm border border-primary/20 bg-primary/10 p-2.5 text-primary">
              <Activity className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardValue>
            <Badge variant={STATUS_VARIANTS[stats?.systemStatus || "healthy"] || "success"} className="text-sm">
              {stats?.systemStatus || "healthy"}
            </Badge>
          </CardValue>
        </Card>
      </div>
    </div>
  );
}
