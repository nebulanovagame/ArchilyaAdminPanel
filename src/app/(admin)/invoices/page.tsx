"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2, Receipt, Check, X, Upload, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type InvoiceItem = {
  id: string;
  user_email: string;
  user_name: string;
  amount: number;
  currency: string;
  type: string;
  plan_id: string | null;
  package_id: string | null;
  credit_amount: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  invoiced_at: string | null;
  invoice_url: string | null;
  payment_id: string | null;
  conversation_id: string | null;
};

type InvoiceResponse = {
  items: InvoiceItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const FILTER_OPTIONS = ["pending", "invoiced", "all"] as const;

function fmtPrice(amount: number) {
  return amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function InvoicesPage() {
  const [data, setData] = useState<InvoiceResponse>({ items: [], page: 1, limit: 50, total: 0, totalPages: 0 });
  const [filter, setFilter] = useState<(typeof FILTER_OPTIONS)[number]>("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef(false);

  const fetchInvoices = useCallback(async (currentFilter: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: currentFilter, limit: "50" });
      const res = await fetch(`/api/admin/invoices?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Yukleme hatasi" }));
        throw new Error(err.error || "Faturalar yuklenemedi");
      }
      const json = (await res.json()) as InvoiceResponse;
      setData(json);
      setSelectedIds(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInvoices(filter);
  }, [filter, fetchInvoices]);

  const handleMarkInvoiced = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setActionLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("ids", JSON.stringify(Array.from(selectedIds)));
      formData.append("action", "mark_invoiced");
      if (invoiceFile) {
        formData.append("invoice", invoiceFile);
      }

      const res = await fetch("/api/admin/invoices", {
        method: "PATCH",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Hata" }));
        throw new Error(err.error || "Islem basarisiz");
      }
      setInvoiceFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchInvoices(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata");
    } finally {
      setActionLoading(false);
    }
  }, [selectedIds, filter, fetchInvoices, invoiceFile]);

  const handleUnmarkInvoiced = useCallback(async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], action: "unmark_invoiced" }),
      });
      if (!res.ok) throw new Error("Islem basarisiz");
      await fetchInvoices(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hata");
    } finally {
      setActionLoading(false);
    }
  }, [filter, fetchInvoices]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    selectAllRef.current = !selectAllRef.current;
    if (selectAllRef.current) {
      setSelectedIds(new Set(data.items.map((i) => i.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [data.items]);

  // CSV Export
  const exportCSV = useCallback(() => {
    const headers = ["ID", "Tarih", "Musteri", "E-posta", "Tutar", "Para Birimi", "Aciklama", "Odeme ID"];
    const rows = data.items.map((i) => [
      i.id,
      fmtDate(i.completed_at),
      i.user_name || "-",
      i.user_email || "-",
      fmtPrice(i.amount),
      i.currency || "TRY",
      i.type === "plan" ? `${i.plan_id} Abonelik` : `${i.package_id} Ek Paket`,
      i.payment_id || "-",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faturalar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data.items]);

  const hasRows = data.items.length > 0;
  const invoicedCount = data.items.filter((i) => i.invoiced_at).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
          <h1 className="font-serif text-3xl text-white italic">Fatura Yonetimi</h1>
          <p className="text-[11px] text-gray-500 mt-1 font-sans">
            Toplam {data.total} odeme | Faturalanan: {invoicedCount} | Bekleyen: {data.total - invoicedCount}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all border ${
                filter === option
                  ? "bg-primary text-black border-primary"
                  : "bg-white/[0.03] text-gray-400 border-white/10 hover:border-white/20"
              }`}
            >
              {option === "all" ? "Hepsi" : option === "pending" ? "Faturalanmamis" : "Faturalanmis"}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-sm bg-primary/5 border border-primary/20 flex-wrap">
          <span className="text-xs text-gray-300 font-sans">{selectedIds.size} secili</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-white/10 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:border-white/20 transition-all"
          >
            <Upload className="w-3 h-3" />
            {invoiceFile ? invoiceFile.name : "PDF Sec"}
          </button>
          <Button type="button" variant="primary" size="sm" onClick={handleMarkInvoiced} disabled={actionLoading}>
            {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            {invoiceFile ? "Faturalandi & PDF Yukle" : "Faturalandi Isaretle"}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={exportCSV}>
            <Download className="w-3 h-3" /> CSV
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300 font-sans">{error}</div>
      )}

      {loading ? (
        <LoadingState message="Faturalar yukleniyor..." />
      ) : !hasRows ? (
        <EmptyState icon={Receipt} title="Faturalanacak odeme bulunamadi" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === data.items.length && data.items.length > 0}
                      onChange={toggleSelectAll}
                      className="accent-primary"
                    />
                  </TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Musteri</TableHead>
                  <TableHead>Aciklama</TableHead>
                  <TableHead className="text-right">Tutar</TableHead>
                  <TableHead>Fatura</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="accent-primary"
                      />
                    </TableCell>
                    <TableCell className="text-[11px] text-gray-400 whitespace-nowrap">{fmtDate(item.completed_at)}</TableCell>
                    <TableCell>
                      <p className="text-xs text-white font-medium">{item.user_name || "-"}</p>
                      <p className="text-[10px] text-gray-500">{item.user_email || "-"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-gray-300">
                        {item.type === "plan"
                          ? `${item.plan_id} Abonelik`
                          : `${item.package_id} Ek Paket`}
                      </p>
                      <p className="text-[10px] text-gray-500">{item.credit_amount} kredi</p>
                    </TableCell>
                    <TableCell className="text-right font-medium text-white whitespace-nowrap">
                      ₺{fmtPrice(item.amount)}
                    </TableCell>
                    <TableCell>
                      {item.invoiced_at ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="success">Faturalandi</Badge>
                          {item.invoice_url && (
                            <a
                              href={item.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:text-white transition-colors"
                              title="Faturayi ac"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ) : (
                        <Badge variant="warning">Bekliyor</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.invoiced_at ? (
                        <button
                          onClick={() => handleUnmarkInvoiced(item.id)}
                          className="text-[10px] text-gray-500 hover:text-red-400 transition-colors font-sans"
                          title="Faturalanmadi olarak isaretle"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedIds(new Set([item.id]));
                            setTimeout(() => handleMarkInvoiced(), 100);
                          }}
                          className="text-[10px] text-primary hover:text-white transition-colors font-sans"
                          title="Faturalandi olarak isaretle"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
