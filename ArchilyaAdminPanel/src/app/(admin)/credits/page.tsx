"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { listCredits } from "@/lib/api/admin-client";
import type { CreditRecord } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const TYPE_VARIANTS: Record<string, "success" | "danger" | "warning" | "info"> = {
  purchase: "info",
  usage: "danger",
  refund: "warning",
  grant: "success",
};

const TYPE_LABELS: Record<string, string> = {
  purchase: "Satinalma",
  usage: "Kullanim",
  refund: "Iade",
  grant: "Hediye",
};

export default function CreditsPage() {
  const [data, setData] = useState<CreditRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listCredits()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Kredi islemleri yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">Kredi Islemleri</h1>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={Coins} title="Kredi islemi bulunamadi" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanici</TableHead>
                <TableHead>Miktar</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Aciklama</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-[11px] text-gray-400">{c.userEmail}</TableCell>
                  <TableCell className={`font-mono text-sm font-bold ${c.amount > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {c.amount > 0 ? "+" : ""}{c.amount.toLocaleString("tr-TR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={TYPE_VARIANTS[c.type] || "default"}>
                      {TYPE_LABELS[c.type] || c.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[11px] text-gray-500 max-w-[200px] truncate">{c.description}</TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString("tr-TR") : "-"}
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
