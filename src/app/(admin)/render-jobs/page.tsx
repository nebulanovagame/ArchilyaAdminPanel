"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Image, Layers } from "lucide-react";
import { listRenderBatches, listRenderJobs } from "@/lib/api/admin-client";
import type { RenderBatchRecord, RenderJobRecord } from "@/lib/api/types";
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

/** Batch durumunu sayfadaki mevcut rozet diline cevirir (render-jobs route'taki statusMap ile ayni). */
function toDisplayStatus(rawStatus: string): string {
  const map: Record<string, string> = {
    pending: "queued",
    running: "processing",
    cancelled: "canceled",
  };
  return map[rawStatus] || rawStatus;
}

function BatchCard({
  batch,
  jobs,
  expanded,
  onToggle,
}: {
  batch: RenderBatchRecord;
  jobs: RenderJobRecord[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const total = batch.totalCount || jobs.length || 0;
  const done = batch.completedCount || jobs.filter((j) => j.status === "completed").length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="glass-card rounded-sm overflow-hidden border-l-2 border-l-primary/60">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        <Layers className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-sans font-semibold text-white truncate">
              {batch.toolId || "Toplu is"}
            </span>
            <Badge variant="default">Toplu</Badge>
            <TableStatus status={toDisplayStatus(batch.status)} />
          </div>
          <p className="text-[11px] font-sans text-gray-500 mt-0.5 truncate">
            {batch.userEmail || "—"} · {done}/{total} tamamlandi
            {batch.failedCount > 0 ? ` · ${batch.failedCount} basarisiz` : ""}
          </p>
        </div>
        <div className="w-32 shrink-0 hidden sm:block">
          <ProgressBar progress={percent} />
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-500 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {expanded && (
        <div className="border-t border-white/5 px-4 py-2">
          {jobs.length === 0 ? (
            <p className="text-[11px] font-sans text-gray-500 py-2">Bu aralikta is kaydi yok.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {jobs.map((job) => (
                <li key={job.id} className="flex items-center gap-3 py-2">
                  <span className="font-mono text-[11px] text-gray-400">
                    #{(job.batchIndex ?? 0) + 1} · {job.id.substring(0, 8)}...
                  </span>
                  <TableStatus status={job.status} />
                  <span className="ml-auto text-[11px] font-sans text-gray-500">
                    {job.createdAt ? new Date(job.createdAt).toLocaleDateString("tr-TR") : "-"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function RenderJobsPage() {
  const [data, setData] = useState<RenderJobRecord[]>([]);
  const [batches, setBatches] = useState<RenderBatchRecord[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listRenderJobs(), listRenderBatches()])
      .then(([jobs, batchList]) => {
        setData(jobs);
        setBatches(batchList);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState message="Render isleri yukleniyor..." />;
  if (error) return <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>;

  // Phase 8: batch'li isler grup kartlarinda, batch'siz isler mevcut tabloda aynen gosterilir.
  const standaloneJobs = data.filter((job) => !job.batchId);
  const jobsByBatch: Record<string, RenderJobRecord[]> = {};
  for (const job of data) {
    if (job.batchId) {
      if (!jobsByBatch[job.batchId]) jobsByBatch[job.batchId] = [];
      jobsByBatch[job.batchId].push(job);
    }
  }
  // Listedeki islerden cikarilan ama batch listesinde olmayan gruplar (pencere disi batch'ler).
  const orphanBatchIds = Object.keys(jobsByBatch).filter((id) => !batches.some((b) => b.id === id));

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  if (data.length === 0 && batches.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
          <h1 className="font-serif text-3xl text-white italic">Render Isleri</h1>
        </div>
        <EmptyState icon={Image} title="Render isi bulunmuyor" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
        <h1 className="font-serif text-3xl text-white italic">Render Isleri</h1>
      </div>

      {(batches.length > 0 || orphanBatchIds.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans">Toplu Isler</h2>
          {batches.map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              jobs={(jobsByBatch[batch.id] || []).sort((a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0))}
              expanded={Boolean(expanded[batch.id])}
              onToggle={() => toggle(batch.id)}
            />
          ))}
          {orphanBatchIds.map((batchId) => {
            const orphanJobs = jobsByBatch[batchId].sort((a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0));
            const first = orphanJobs[0];
            const fallback: RenderBatchRecord = {
              id: batchId,
              toolId: first?.batch?.toolId || first?.projectName || "",
              status: first?.batch?.status || "pending",
              totalCount: first?.batch?.totalCount || orphanJobs.length,
              completedCount: first?.batch?.completedCount || 0,
              failedCount: first?.batch?.failedCount || 0,
              userId: "",
              userEmail: first?.userEmail || "",
              creditUnit: 0,
              createdAt: first?.createdAt || new Date().toISOString(),
              updatedAt: null,
              completedAt: null,
            };
            return (
              <BatchCard
                key={batchId}
                batch={fallback}
                jobs={orphanJobs}
                expanded={Boolean(expanded[batchId])}
                onToggle={() => toggle(batchId)}
              />
            );
          })}
        </section>
      )}

      {standaloneJobs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans">Tekil Isler</h2>
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
                {standaloneJobs.map((job) => (
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
        </section>
      )}
    </div>
  );
}
