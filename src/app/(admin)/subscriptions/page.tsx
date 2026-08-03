"use client";

import { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import {
  listSubscriptions,
  cancelSubscription,
  refundSubscription,
  changeSubscriptionPlan,
} from "@/lib/api/admin-client";
import type { SubscriptionRecord } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableStatus } from "@/components/ui/table";

const PLANS = ["solo", "pro", "studio"] as const;

export default function SubscriptionsPage() {
  const [data, setData] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<Record<string, string>>({});
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});

  const refresh = () => {
    setLoading(true);
    setError(null);
    listSubscriptions()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    listSubscriptions()
      .then((items) => {
        if (!cancelled) setData(items);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleCancel = async (id: string) => {
    if (!window.confirm("Abonelik iptal edilsin mi?")) return;
    setLoadingAction((prev) => ({ ...prev, [id]: "cancel" }));
    try {
      await cancelSubscription(id);
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Islem basarisiz";
      alert(msg);
    } finally {
      setLoadingAction((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleRefund = async (id: string) => {
    if (!window.confirm("Odeme iadesi yapilsin mi? (Kredi iadesi dahil)")) return;
    setLoadingAction((prev) => ({ ...prev, [id]: "refund" }));
    try {
      await refundSubscription(id);
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Islem basarisiz";
      alert(msg);
    } finally {
      setLoadingAction((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleChangePlan = async (id: string) => {
    const plan = selectedPlans[id];
    if (!plan) {
      alert("Lutfen bir plan secin.");
      return;
    }
    if (!window.confirm(`Plan "${plan}" olarak degistirilsin mi?`)) return;
    setLoadingAction((prev) => ({ ...prev, [id]: "change-plan" }));
    try {
      await changeSubscriptionPlan(id, plan as "solo" | "pro" | "studio");
      setSelectedPlans((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Islem basarisiz";
      alert(msg);
    } finally {
      setLoadingAction((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const isActive = (status: string) =>
    status === "active" || status === "trialing";

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
                <TableHead>Islemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => {
                const busy = loadingAction[s.id];
                const statusLower = s.status.toLowerCase();
                const isCancelled = statusLower === "cancelled" || statusLower === "canceled";

                return (
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
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {!isCancelled && (
                          <Button
                            variant="danger"
                            size="sm"
                            loading={busy === "cancel"}
                            disabled={!!busy}
                            onClick={() => handleCancel(s.id)}
                          >
                            Iptal
                          </Button>
                        )}
                        {isActive(s.status) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={busy === "refund"}
                            disabled={!!busy}
                            onClick={() => handleRefund(s.id)}
                          >
                            Iade
                          </Button>
                        )}
                        {!isCancelled && (
                          <div className="flex items-center gap-1">
                            <select
                              className="rounded-sm border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] text-gray-300 uppercase tracking-wider focus:border-primary/40 focus:outline-none"
                              value={selectedPlans[s.id] || ""}
                              onChange={(e) =>
                                setSelectedPlans((prev) => ({
                                  ...prev,
                                  [s.id]: e.target.value,
                                }))
                              }
                              disabled={!!busy}
                            >
                              <option value="" disabled>Plan</option>
                              {PLANS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="sm"
                              loading={busy === "change-plan"}
                              disabled={!!busy || !selectedPlans[s.id]}
                              onClick={() => handleChangePlan(s.id)}
                            >
                              Degistir
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
