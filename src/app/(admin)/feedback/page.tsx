"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Lightbulb, Sparkles, Bug, Clock, CheckCircle, XCircle, Eye, Pencil } from "lucide-react";
import { listFeedback, updateFeedbackStatus } from "@/lib/api/admin-client";
import type { FeedbackRecord, FeedbackCategory, FeedbackStatus } from "@/lib/api/types";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "Yeni",
  in_review: "Değerlendiriliyor",
  done: "Tamamlandı",
  wont_do: "Yapılmayacak",
  closed: "Kapatıldı",
};

const STATUS_VARIANTS: Record<FeedbackStatus, "default" | "success" | "warning" | "danger"> = {
  new: "warning",
  in_review: "default",
  done: "success",
  wont_do: "danger",
  closed: "default",
};

const STATUS_ICONS: Record<FeedbackStatus, React.ElementType> = {
  new: Clock,
  in_review: Eye,
  done: CheckCircle,
  wont_do: XCircle,
  closed: XCircle,
};

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  suggestion: "Öneri",
  feature: "İstek",
  bug: "Hata",
  other: "Diğer",
};

const CATEGORY_ICONS: Record<FeedbackCategory, React.ElementType> = {
  suggestion: Lightbulb,
  feature: Sparkles,
  bug: Bug,
  other: MessageSquare,
};

const CATEGORY_VARIANTS: Record<FeedbackCategory, "default" | "success" | "warning" | "danger"> = {
  suggestion: "default",
  feature: "success",
  bug: "danger",
  other: "warning",
};

export default function FeedbackPage() {
  const [items, setItems] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "all">("all");
  const [editing, setEditing] = useState<FeedbackRecord | null>(null);
  const [editStatus, setEditStatus] = useState<FeedbackStatus>("new");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listFeedback(
        statusFilter === "all" ? undefined : statusFilter,
        categoryFilter === "all" ? undefined : categoryFilter,
      );
      setItems(data);
    } catch {
      setError("Geri bildirimler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchItems(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchItems]);

  function openEdit(fb: FeedbackRecord) {
    setEditing(fb);
    setEditStatus(fb.status);
    setEditNote(fb.adminNote || "");
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateFeedbackStatus(editing.id, editStatus, editNote || undefined);
      setEditing(null);
      await fetchItems();
    } catch {
      setError("Geri bildirim güncellenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Yönetim</p>
        <h2 className="font-serif text-3xl text-white italic">Geri Bildirimler</h2>
        <p className="text-gray-500 text-xs mt-1">Kullanıcı önerileri, istekleri ve hata bildirimleri</p>
      </div>

      {error && (
        <div className="mb-6 rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="flex gap-2 mb-3 flex-wrap">
        {(["all", "new", "in_review", "done", "wont_do", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${
              statusFilter === s ? "bg-primary text-black" : "bg-white/5 text-gray-400 hover:text-white"
            }`}
          >
            {s === "all" ? "Tümü" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["all", "suggestion", "feature", "bug", "other"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${
              categoryFilter === c ? "bg-primary text-black" : "bg-white/5 text-gray-400 hover:text-white"
            }`}
          >
            {c === "all" ? "Tümü" : CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Geri bildirimler yükleniyor..." />
      ) : items.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Geri bildirim bulunamadı" description="Henüz hiçbir geri bildirim yok." />
      ) : (
        <div className="rounded-sm overflow-hidden border border-white/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Mesaj</TableHead>
                <TableHead>Sayfa</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((fb) => {
                const StatusIcon = STATUS_ICONS[fb.status];
                const CategoryIcon = CATEGORY_ICONS[fb.category];
                return (
                  <TableRow key={fb.id}>
                    <TableCell>
                      <p className="text-sm text-white font-medium">{fb.userEmail || "Anonim"}</p>
                      <Badge variant={CATEGORY_VARIANTS[fb.category]} className="mt-1">
                        <CategoryIcon className="w-3 h-3 mr-1" />
                        {CATEGORY_LABELS[fb.category]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-gray-400 line-clamp-2">{fb.message}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-400">{fb.pagePath || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[fb.status]}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {STATUS_LABELS[fb.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">
                        {new Date(fb.createdAt).toLocaleDateString("tr-TR")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openEdit(fb)}
                        className="text-gray-500 hover:text-primary transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d0f13] border border-white/10 rounded-sm w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4">
            <div className="p-8 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-2xl text-white italic">Geri Bildirim Detayı</h3>
                <button type="button" onClick={() => setEditing(null)} className="text-gray-500 hover:text-white text-lg">&times;</button>
              </div>

              <div className="space-y-3 text-sm">
                {editing.userEmail && (
                  <div className="flex items-center gap-2 text-gray-300">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Kullanıcı:</span>
                    <span className="text-white font-medium">{editing.userEmail}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-gray-400">
                  <span className="text-[10px] text-gray-500 uppercase tracking-widest">Kategori:</span>
                  <Badge variant={CATEGORY_VARIANTS[editing.category]}>
                    {(() => {
                      const CatIcon = CATEGORY_ICONS[editing.category];
                      return <CatIcon className="w-3 h-3 mr-1" />;
                    })()}
                    {CATEGORY_LABELS[editing.category]}
                  </Badge>
                </div>
                {editing.pagePath && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest">Sayfa:</span>
                    {editing.pagePath}
                  </div>
                )}
                <div className="mt-3 p-3 rounded-sm bg-white/5 border border-white/5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Mesaj</p>
                  <p className="text-gray-300 text-sm">{editing.message}</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Durum</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as FeedbackStatus)}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary/40 focus:outline-none"
                  >
                    {(Object.keys(STATUS_LABELS) as FeedbackStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Admin Notu</label>
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none"
                    rows={3}
                    placeholder="İç not ekleyin..."
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-primary text-black rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
