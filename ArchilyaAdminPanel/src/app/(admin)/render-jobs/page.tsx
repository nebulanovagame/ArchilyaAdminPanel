"use client";

import { useEffect, useState } from "react";
import { Image } from "lucide-react";
import { listRenderJobs } from "@/lib/api/admin-client";
import type { RenderJobRecord } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableStatus } from "@/components/ui/table";

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-full bg-white/5 rounded-full h-1.5 min-w-[60px]">
        <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <span className="text-[10px] font-sans text-gray-500 w-8 text-right">{progress}%</span>
    </div>
  );
}

export default function RenderJobsPage() {
  const [data, setData] = useState<RenderJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listRenderJobs()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Render isleri yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">Render Isleri</h1>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={Image} title="Render isi bulunmuyor" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Is ID</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kullanici</TableHead>
                <TableHead>Proje</TableHead>
                <TableHead>Ilerleme</TableHead>
                <TableHead>Olusturulma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-[11px]">{job.id.substring(0, 8)}...</TableCell>
                  <TableCell>
                    <Badge variant={job.type === "render" ? "info" : "warning"}>
                      {job.type === "render" ? "Render" : "AI"}
                    </Badge>
                  </TableCell>
                  <TableCell><TableStatus status={job.status} /></TableCell>
                  <TableCell className="text-[11px] text-gray-400">{job.userEmail}</TableCell>
                  <TableCell className="text-[11px]">{job.projectName}</TableCell>
                  <TableCell><ProgressBar progress={job.progress} /></TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {job.createdAt ? new Date(job.createdAt).toLocaleDateString("tr-TR") : "-"}
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
