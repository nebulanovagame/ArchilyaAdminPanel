"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { listAuditLogs } from "@/lib/api/admin-client";
import type { AuditLogEntry } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ACTION_CONFIG: Record<string, { label: string; variant: "info" | "success" | "danger" | "warning" | "neutral" }> = {
  "user.login": { label: "Giris", variant: "info" },
  "user.create": { label: "Kullanici Olusturma", variant: "success" },
  "workspace.delete": { label: "WS Silme", variant: "danger" },
  "credits.grant": { label: "Kredi Verme", variant: "warning" },
  "settings.update": { label: "Ayar Guncelleme", variant: "neutral" },
};

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAuditLogs()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Denetim kaydi yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">Denetim Kaydi</h1>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={ScrollText} title="Denetim kaydi bulunmuyor" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Islem</TableHead>
                <TableHead>Kaynak</TableHead>
                <TableHead>Kaynak ID</TableHead>
                <TableHead>Detay</TableHead>
                <TableHead>Aktor</TableHead>
                <TableHead>Tarih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((log) => {
                const config = ACTION_CONFIG[log.action] || { label: log.action, variant: "neutral" as const };
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </TableCell>
                    <TableCell className="text-[11px] uppercase tracking-wider text-gray-500">{log.resource}</TableCell>
                    <TableCell className="font-mono text-[11px] text-gray-400">{log.resourceId.substring(0, 8)}</TableCell>
                    <TableCell className="text-[11px] text-gray-500 max-w-[200px] truncate">{log.details || "-"}</TableCell>
                    <TableCell className="text-[11px] text-gray-400">{log.actorEmail}</TableCell>
                    <TableCell className="text-[11px] text-gray-500">
                      {log.createdAt ? new Date(log.createdAt).toLocaleString("tr-TR") : "-"}
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
