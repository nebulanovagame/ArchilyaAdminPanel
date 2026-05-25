"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { listSubscriptions } from "@/lib/api/admin-client";
import type { SubscriptionRecord } from "@/lib/api/types";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableStatus } from "@/components/ui/table";

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSubscriptions()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Abonelikler yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">Abonelikler</h1>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={CreditCard} title="Abonelik bulunamadi" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanici</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Donem Baslangici</TableHead>
                <TableHead>Donem Bitisi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-[11px] text-gray-400">{s.userEmail}</TableCell>
                  <TableCell className="font-medium text-white">{s.planName}</TableCell>
                  <TableCell><TableStatus status={s.status} /></TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {s.currentPeriodStart ? new Date(s.currentPeriodStart).toLocaleDateString("tr-TR") : "-"}
                  </TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString("tr-TR") : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
