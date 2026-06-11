"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { listPaymentSessions } from "@/lib/api/admin-client";
import type { PaymentSessionRecord, PaymentSessionStatus, PaymentSessionsResponse } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_OPTIONS = ["all", "pending", "completed", "failed"] as const;

const STATUS_VARIANTS: Record<PaymentSessionStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  completed: "success",
  failed: "danger",
};

const INITIAL_DATA: PaymentSessionsResponse = {
  items: [],
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};

export default function PaymentSessionsPage() {
  const [data, setData] = useState<PaymentSessionsResponse>(INITIAL_DATA);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await listPaymentSessions({ status, page: 1, limit: 20 });
        if (!cancelled) {
          setData(response);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Odeme oturumlari yuklenemedi");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  const hasRows = useMemo(() => data.items.length > 0, [data.items]);

  if (loading) return <LoadingState message="Odeme oturumlari yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
          <h1 className="font-serif text-3xl text-white italic">Odeme Oturumlari</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((option) => (
            <Button
              key={option}
              type="button"
              variant={status === option ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setLoading(true);
                setError(null);
                setStatus(option);
              }}
            >
              {option === "all" ? "Tum" : option}
            </Button>
          ))}
        </div>
      </div>

      {hasRows ? (
        <>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-sans">
            Toplam {data.total.toLocaleString("tr-TR")} kayit
          </div>

          <div className="glass-card rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>User Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount (₺)</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((session: PaymentSessionRecord) => (
                  <TableRow key={session.token}>
                    <TableCell className="font-mono text-[11px] text-gray-400 max-w-[180px] truncate">{session.token}</TableCell>
                    <TableCell className="text-[11px] text-gray-400">{session.userEmail || "-"}</TableCell>
                    <TableCell className="font-medium text-white">{session.plan || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[session.status] || "default"}>{session.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-white">{session.amount.toLocaleString("tr-TR")}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary">{session.credits.toLocaleString("tr-TR")}</TableCell>
                    <TableCell className="text-[11px] text-gray-500">
                      {session.createdAt ? new Date(session.createdAt).toLocaleString("tr-TR") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <EmptyState icon={CreditCard} title="Odeme oturumu bulunamadi" />
      )}
    </div>
  );
}
