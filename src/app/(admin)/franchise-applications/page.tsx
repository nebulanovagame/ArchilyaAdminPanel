"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Building2, MapPin, Phone, Mail, CheckCircle, XCircle, Clock, Pencil } from "lucide-react";
import {
  listFranchiseApplications,
  updateFranchiseApplicationStatus,
} from "@/lib/api/admin-client";
import type { FranchiseApplicationRecord, FranchiseApplicationStatus } from "@/lib/api/types";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<FranchiseApplicationStatus, string> = {
  pending: "Beklemede",
  contacted: "İletişime Geçildi",
  qualified: "Uygun Aday",
  rejected: "Reddedildi",
  closed: "Kapatıldı",
};

const STATUS_VARIANTS: Record<FranchiseApplicationStatus, "default" | "success" | "warning" | "danger"> = {
  pending: "warning",
  contacted: "default",
  qualified: "success",
  rejected: "danger",
  closed: "default",
};

const STATUS_ICONS: Record<FranchiseApplicationStatus, React.ElementType> = {
  pending: Clock,
  contacted: Phone,
  qualified: CheckCircle,
  rejected: XCircle,
  closed: XCircle,
};

export default function FranchiseApplicationsPage() {
  const [applications, setApplications] = useState<FranchiseApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<FranchiseApplicationStatus | "all">("all");
  const [editing, setEditing] = useState<FranchiseApplicationRecord | null>(null);
  const [editStatus, setEditStatus] = useState<FranchiseApplicationStatus>("pending");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listFranchiseApplications(filter === "all" ? undefined : filter);
      setApplications(data);
    } catch {
      setError("Başvurular yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  function openEdit(app: FranchiseApplicationRecord) {
    setEditing(app);
    setEditStatus(app.status);
    setEditNote(app.adminNote || "");
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await updateFranchiseApplicationStatus(editing.id, editStatus, editNote || undefined);
      setEditing(null);
      await fetchApplications();
    } catch {
      setError("Başvuru güncellenemedi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Yönetim</p>
        <h2 className="font-serif text-3xl text-white italic">Franchise Başvuruları</h2>
      </div>

      {error && (
        <div className="mb-6 rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["all", "pending", "contacted", "qualified", "rejected", "closed"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${
              filter === s ? "bg-primary text-black" : "bg-white/5 text-gray-400 hover:text-white"
            }`}
          >
            {s === "all" ? "Tümü" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Başvurular yükleniyor..." />
      ) : applications.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Başvuru bulunamadı" description="Henüz hiçbir franchise başvurusu yok." />
      ) : (
        <div className="rounded-sm overflow-hidden border border-white/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Başvuran</TableHead>
                <TableHead>Şirket</TableHead>
                <TableHead>Konum</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead>Bütçe</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((app) => {
                const StatusIcon = STATUS_ICONS[app.status];
                return (
                  <TableRow key={app.id}>
                    <TableCell>
                      <p className="text-sm text-white font-medium">{app.name}</p>
                      {app.message && (
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{app.message}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Building2 className="w-3 h-3" />
                        {app.company || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <MapPin className="w-3 h-3" />
                        {app.city || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {app.phone && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Phone className="w-3 h-3" />
                            {app.phone}
                          </div>
                        )}
                        {app.email && (
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Mail className="w-3 h-3" />
                            {app.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-400">{app.budgetRange || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[app.status]}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {STATUS_LABELS[app.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">
                        {new Date(app.createdAt).toLocaleDateString("tr-TR")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => openEdit(app)}
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
                <h3 className="font-serif text-2xl text-white italic">Başvuru Detayı</h3>
                <button type="button" onClick={() => setEditing(null)} className="text-gray-500 hover:text-white text-lg">&times;</button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-white font-medium">{editing.name}</span>
                  {editing.company && <span className="text-gray-500">— {editing.company}</span>}
                </div>
                {editing.city && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <MapPin className="w-4 h-4" />
                    {editing.city}
                  </div>
                )}
                {editing.phone && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Phone className="w-4 h-4" />
                    {editing.phone}
                  </div>
                )}
                {editing.email && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Mail className="w-4 h-4" />
                    {editing.email}
                  </div>
                )}
                {editing.budgetRange && (
                  <p className="text-gray-400">Bütçe: <span className="text-white">{editing.budgetRange}</span></p>
                )}
                {editing.message && (
                  <div className="mt-3 p-3 rounded-sm bg-white/5 border border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Mesaj</p>
                    <p className="text-gray-300 text-sm">{editing.message}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Durum</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as FranchiseApplicationStatus)}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary/40 focus:outline-none"
                  >
                    {(Object.keys(STATUS_LABELS) as FranchiseApplicationStatus[]).map((s) => (
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
