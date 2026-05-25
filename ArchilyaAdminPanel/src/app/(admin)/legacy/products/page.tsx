"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { listLegacyProducts } from "@/lib/api/admin-client";
import type { LegacyProduct } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function LegacyProductsPage() {
  const [data, setData] = useState<LegacyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLegacyProducts()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Eski Sistem</p>
        <h1 className="font-serif text-3xl text-white italic">Urunler</h1>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={Package} title="Urun bulunmuyor" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Isim</TableHead>
                <TableHead>Fiyat</TableHead>
                <TableHead>Aktif</TableHead>
                <TableHead>Olusturulma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-white">{p.name}</TableCell>
                  <TableCell className="font-mono">{p.currency === "TRY" ? "₺" : "$"}{p.price.toLocaleString("tr-TR")}</TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "success" : "neutral"}>{p.active ? "Aktif" : "Pasif"}</Badge>
                  </TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString("tr-TR") : "-"}
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
