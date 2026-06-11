"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ShieldAlert } from "lucide-react";
import { listPaymentReconciliation } from "@/lib/api/admin-client";
import type { PaymentReconciliationIssue, PaymentReconciliationResponse } from "@/lib/api/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const INITIAL_DATA: PaymentReconciliationResponse = {
  items: [],
  total: 0,
};

export default function PaymentReconciliationPage() {
  const [data, setData] = useState<PaymentReconciliationResponse>(INITIAL_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await listPaymentReconciliation();
        if (!cancelled) {
          setData(response);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Odeme mutabakat verisi yuklenemedi");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) return <LoadingState message="Odeme mutabakat verisi yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
          <h1 className="font-serif text-3xl text-white italic">Odeme Mutabakati</h1>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={refreshing}
          onClick={() => {
            setError(null);
            setRefreshing(true);
            setRefreshKey((current) => current + 1);
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Auto-refresh
        </Button>
      </div>

      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-sans">
        Toplam sorun: {data.total.toLocaleString("tr-TR")}
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="Odeme mutabakat sorunu bulunamadi" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>User Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((issue: PaymentReconciliationIssue, index: number) => (
                <TableRow key={`${issue.token}-${issue.type}-${index}`}>
                  <TableCell className="font-medium text-red-300">{issue.type}</TableCell>
                  <TableCell className="font-mono text-[11px] text-gray-400 max-w-[180px] truncate">{issue.token || "-"}</TableCell>
                  <TableCell className="text-[11px] text-gray-400">{issue.userEmail || "-"}</TableCell>
                  <TableCell className="text-white">{issue.plan || "-"}</TableCell>
                  <TableCell className="text-[11px] text-gray-400 max-w-[360px] whitespace-normal break-words">{issue.message}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
