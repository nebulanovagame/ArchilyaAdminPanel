"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { listWorkspaces } from "@/lib/api/admin-client";
import type { WorkspaceRecord } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableStatus } from "@/components/ui/table";

export default function WorkspacesPage() {
  const [data, setData] = useState<WorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWorkspaces()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Workspace verileri yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">Calisma Alanlari</h1>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={Building2} title="Workspace bulunamadi" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Isim</TableHead>
                <TableHead>Sahip</TableHead>
                <TableHead>Uye Sayisi</TableHead>
                <TableHead>Depolama (MB)</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Olusturulma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((ws) => (
                <TableRow key={ws.id}>
                  <TableCell className="font-medium text-white">{ws.name}</TableCell>
                  <TableCell className="text-[11px] text-gray-400">{ws.ownerEmail}</TableCell>
                  <TableCell>{ws.memberCount}</TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {ws.storageUsed ? Math.round(ws.storageUsed / (1024 * 1024)).toLocaleString("tr-TR") : "0"}
                  </TableCell>
                  <TableCell><TableStatus status={ws.status} /></TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {ws.createdAt ? new Date(ws.createdAt).toLocaleDateString("tr-TR") : "-"}
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
