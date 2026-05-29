"use client";

import { useEffect, useState } from "react";
import { FolderKanban } from "lucide-react";
import { listProjects } from "@/lib/api/admin-client";
import type { ProjectRecord } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "info" | "neutral"> = {
  "Aktif": "success",
  "Tamamlandi": "info",
  "Taslak": "neutral",
  "Incelemede": "warning",
};

export default function ProjectsPage() {
  const [data, setData] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProjects()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Projeler yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">Projeler</h1>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={FolderKanban} title="Proje bulunamadi" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Isim</TableHead>
                <TableHead>Sahip</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Dosya Sayisi</TableHead>
                <TableHead>Guncellenme</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-white">{p.name}</TableCell>
                  <TableCell className="text-[11px] text-gray-400">{p.ownerEmail}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[p.status] || "neutral"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell>{p.fileCount}</TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString("tr-TR") : "-"}
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
