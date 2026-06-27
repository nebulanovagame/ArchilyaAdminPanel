"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, ListFilter, RefreshCw, Search, ScrollText } from "lucide-react";
import type { AuditLogEntry } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const ACTION_CONFIG: Record<string, { label: string; variant: "info" | "success" | "danger" | "warning" | "neutral" }> = {
  "aiJobQueued": { label: "AI İş Kuyruğa", variant: "info" },
  "aiJobCompleted": { label: "AI İş Tamam", variant: "success" },
  "aiJobFailed": { label: "AI İş Hata", variant: "danger" },
  "ai_job_manual_retry": { label: "AI Retry", variant: "warning" },
  "createProject": { label: "Proje Oluşturma", variant: "success" },
  "softDeleteProject": { label: "Proje Silme", variant: "danger" },
  "restoreProject": { label: "Proje Geri Yükleme", variant: "info" },
  "credits_grant": { label: "Kredi Verme", variant: "warning" },
  "credits_deduct": { label: "Kredi Silme", variant: "danger" },
  "send_notification": { label: "Bildirim", variant: "info" },
};

const ACTION_OPTIONS = [
  { value: "", label: "Tüm İşlemler" },
  { value: "aiJobQueued", label: "AI İş Kuyruğa" },
  { value: "aiJobCompleted", label: "AI İş Tamam" },
  { value: "aiJobFailed", label: "AI İş Hata" },
  { value: "createProject", label: "Proje Oluşturma" },
  { value: "softDeleteProject", label: "Proje Silme" },
  { value: "credits_grant", label: "Kredi Verme" },
  { value: "credits_deduct", label: "Kredi Silme" },
  { value: "send_notification", label: "Bildirim" },
];

const DAYS_OPTIONS = [
  { value: 7, label: "7 Gün" },
  { value: 30, label: "30 Gün" },
  { value: 90, label: "90 Gün" },
];

const ITEMS_PER_PAGE = 50;

export default function AuditLogsPage() {
  const [data, setData] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set("action", actionFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("days", String(days));
      params.set("limit", String(ITEMS_PER_PAGE));
      params.set("offset", String(page * ITEMS_PER_PAGE));

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error?.message || "Veri yuklenemedi");
      setData(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Veri yuklenirken hata.");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, searchQuery, days, page]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handleSearch = () => {
    setPage(0);
    setSearchQuery(searchInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
          <h1 className="font-serif text-3xl text-white italic">Denetim Kaydi</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Yenile
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <ListFilter className="w-3.5 h-3.5 text-gray-500" />
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
            className="bg-[#0d0f13] border border-white/10 rounded-sm text-xs text-gray-300 px-2 py-1.5 font-sans outline-none focus:border-primary/50"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          <div className="flex gap-1">
            {DAYS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setDays(opt.value); setPage(0); }}
                className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm border transition-colors ${
                  days === opt.value
                    ? "border-primary/50 text-primary bg-primary/5"
                    : "border-white/5 text-gray-500 hover:text-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Eposta veya isim ara..."
            className="bg-[#0d0f13] border border-white/10 rounded-sm text-xs text-gray-300 px-2 py-1.5 w-48 font-sans outline-none placeholder:text-gray-600 focus:border-primary/50"
          />
          <Button variant="ghost" size="sm" onClick={handleSearch}>
            <Search className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <LoadingState message="Denetim kaydi yukleniyor..." />
      ) : error ? (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>
      ) : data.length === 0 ? (
        <EmptyState icon={ScrollText} title="Denetim kaydi bulunmuyor" description={actionFilter ? "Bu filtreye uygun kayit yok." : undefined} />
      ) : (
        <>
          <div className="glass-card rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İşlem</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Kaynak</TableHead>
                  <TableHead>Detay</TableHead>
                  <TableHead>Aktör (Eposta)</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((log) => {
                  const config = ACTION_CONFIG[log.action] || { label: log.action, variant: "neutral" as const };
                  let detailsText = log.details || "-";
                  try { const parsed = JSON.parse(detailsText); detailsText = JSON.stringify(parsed).slice(0, 120); } catch {}
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </TableCell>
                      <TableCell className="text-[11px] uppercase tracking-wider text-gray-500">
                        {log.action?.startsWith("aiJob") || log.action?.startsWith("ai_") ? "AI" : log.category || "-"}
                      </TableCell>
                      <TableCell className="text-[11px] text-gray-400 max-w-[120px] truncate">
                        <span className="text-[10px] uppercase tracking-wider text-gray-600">{log.resource || "-"}</span>
                        <br />
                        <span className="font-mono text-[10px]">{log.resourceId?.substring(0, 8)}</span>
                      </TableCell>
                      <TableCell className="text-[11px] text-gray-500 max-w-[200px] truncate" title={detailsText}>
                        {detailsText}
                      </TableCell>
                      <TableCell className="text-[11px] text-gray-400 max-w-[160px] truncate">
                        {log.actorEmail || "-"}
                      </TableCell>
                      <TableCell className="text-[11px] text-gray-500 whitespace-nowrap">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString("tr-TR") : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-xs font-sans text-gray-500">
              <span>Toplam {total} kayit ({page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, total)})</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-1 rounded-sm border border-white/5 hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const pageNum = start + i;
                  if (pageNum >= totalPages) return null;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setPage(pageNum)}
                      className={`w-7 h-7 rounded-sm text-[11px] transition-colors ${
                        page === pageNum
                          ? "bg-primary/10 text-primary border border-primary/30"
                          : "text-gray-500 border border-white/5 hover:border-white/10"
                      }`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 rounded-sm border border-white/5 hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
