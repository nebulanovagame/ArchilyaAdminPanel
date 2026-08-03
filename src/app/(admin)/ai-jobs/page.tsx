"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { listAiJobs, refundAiJob } from "@/lib/api/admin-client";
import type { AiJobRecord } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableStatus } from "@/components/ui/table";

export default function AiJobsPage() {
  const [data, setData] = useState<AiJobRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<Set<string>>(new Set());

  const fetchData = useCallback(() => {
    listAiJobs({ days: 7 })
      .then((jobs) => setData(jobs))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefund = async (job: AiJobRecord) => {
    if (typeof window === "undefined") return;
    if (!window.confirm("Kredi iadesi yapilsin mi?")) return;
    setRefunding((prev) => new Set(prev).add(job.id));
    try {
      await refundAiJob(job.id, { reason: "Admin panel iadesi" });
      window.location.reload();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Iade islemi basarisiz";
      alert(message);
      setRefunding((prev) => {
        const next = new Set(prev);
        next.delete(job.id);
        return next;
      });
    }
  };

  if (loading) return <LoadingState message="AI isleri yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">AI Isleri</h1>
      </div>

      {data.length === 0 ? (
        <EmptyState icon={Brain} title="AI isi bulunmuyor" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Is ID</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Kullanici</TableHead>
                <TableHead>Proje</TableHead>
                <TableHead>Olusturulma</TableHead>
                <TableHead>Iade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-[11px]">{job.id.substring(0, 8)}...</TableCell>
                  <TableCell><TableStatus status={job.status} /></TableCell>
                  <TableCell className="text-[11px] text-gray-400">{job.userEmail}</TableCell>
                  <TableCell className="text-[11px]">{job.projectName}</TableCell>
                  <TableCell className="text-[11px] text-gray-500">
                    {job.createdAt ? new Date(job.createdAt).toLocaleDateString("tr-TR") : "-"}
                  </TableCell>
                  <TableCell>
                    {job.billing.refunded ? (
                      <Badge variant="success">Iade edildi ({job.billing.amount})</Badge>
                    ) : (job.status === "failed" || job.status === "canceled") ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={refunding.has(job.id)}
                        onClick={() => void handleRefund(job)}
                      >
                        Iade
                      </Button>
                    ) : null}
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
