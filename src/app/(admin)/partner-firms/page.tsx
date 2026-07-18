"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, MapPin, Globe, Plus, Pencil, ExternalLink } from "lucide-react";
import {
  listPartnerFirms,
  createPartnerFirm,
  updatePartnerFirm,
  deletePartnerFirm,
} from "@/lib/api/admin-client";
import type { PartnerFirmRecord, PartnerFirmType, PartnerFirmCategory } from "@/lib/api/types";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableStatus } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<PartnerFirmType, string> = { branch: "Şube", partner: "İş Ortağı" };
const CATEGORY_LABELS: Record<PartnerFirmCategory, string> = {
  mimarlik_ofisi: "Mimarlık Ofisi",
  muteahhit: "Müteahhit",
  emlakci: "Emlakçı",
  diger: "Diğer",
};

const EMPTY_FORM = {
  name: "",
  type: "partner" as PartnerFirmType,
  category: "diger" as PartnerFirmCategory,
  address: "",
  city: "",
  country: "Türkiye",
  latitude: null as number | null,
  longitude: null as number | null,
  phone: "",
  email: "",
  website: "",
  socialMedia: {} as Record<string, string>,
  logoUrl: "",
  description: "",
  isActive: true,
  orderIndex: 0,
};

export default function PartnerFirmsPage() {
  const [firms, setFirms] = useState<PartnerFirmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<PartnerFirmType | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PartnerFirmRecord | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchFirms = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listPartnerFirms(filter === "all" ? undefined : filter);
      setFirms(data);
    } catch {
      setError("Firmalar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchFirms(); }, [fetchFirms]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updatePartnerFirm(editing.id, form as unknown as Partial<PartnerFirmRecord>);
      } else {
        await createPartnerFirm(form as unknown as PartnerFirmRecord);
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await fetchFirms();
    } catch {
      setError("Firma kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(firm: PartnerFirmRecord) {
    setEditing(firm);
    setForm({
      name: firm.name,
      type: firm.type,
      category: firm.category,
      address: firm.address || "",
      city: firm.city || "",
      country: firm.country,
      latitude: firm.latitude,
      longitude: firm.longitude,
      phone: firm.phone || "",
      email: firm.email || "",
      website: firm.website || "",
      socialMedia: firm.socialMedia,
      logoUrl: firm.logoUrl || "",
      description: firm.description || "",
      isActive: firm.isActive,
      orderIndex: firm.orderIndex,
    });
    setShowForm(true);
  }

  async function handleToggleActive(firm: PartnerFirmRecord) {
    try {
      await updatePartnerFirm(firm.id, { isActive: !firm.isActive } as Partial<PartnerFirmRecord>);
      await fetchFirms();
    } catch {
      setError("Durum güncellenemedi.");
    }
  }

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Yönetim</p>
          <h2 className="font-serif text-3xl text-white italic">Şubeler & İş Ortakları</h2>
        </div>
        <Button variant="primary" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }}>
          <Plus className="w-3.5 h-3.5" /> Yeni Ekle
        </Button>
      </div>

      {error && (
        <div className="mb-6 rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="flex gap-2 mb-6">
        {(["all", "branch", "partner"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${
              filter === f ? "bg-primary text-black" : "bg-white/5 text-gray-400 hover:text-white"
            }`}
          >
            {f === "all" ? "Tümü" : TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Firmalar yükleniyor..." />
      ) : firms.length === 0 ? (
        <EmptyState icon={Building2} title="Firma bulunamadı" description="Henüz hiçbir şube veya iş ortağı eklenmemiş." />
      ) : (
        <div className="rounded-sm overflow-hidden border border-white/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firma</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Konum</TableHead>
                <TableHead>İletişim</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {firms.map((firm) => (
                <TableRow key={firm.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm text-white font-medium">{firm.name}</p>
                      {firm.description && (
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{firm.description}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={firm.type === "branch" ? "success" : "default"}>
                      {TYPE_LABELS[firm.type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-gray-400">{CATEGORY_LABELS[firm.category]}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <MapPin className="w-3 h-3" />
                      {firm.city || "-"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {firm.website && (
                        <a href={firm.website} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-primary transition-colors">
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {firm.socialMedia?.instagram && (
                        <a href={firm.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-primary transition-colors text-[10px]">
                          IG
                        </a>
                      )}
                      {firm.socialMedia?.linkedin && (
                        <a href={firm.socialMedia.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-primary transition-colors text-[10px]">
                          IN
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleToggleActive(firm)}
                      className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm transition-all ${
                        firm.isActive ? "text-emerald-400 bg-emerald-400/10" : "text-gray-600 bg-white/5"
                      }`}
                    >
                      {firm.isActive ? "Aktif" : "Pasif"}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => openEdit(firm)}
                      className="text-gray-500 hover:text-primary transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d0f13] border border-white/10 rounded-sm w-full max-w-xl max-h-[90vh] overflow-y-auto mx-4">
            <form onSubmit={handleSave} className="p-8 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-2xl text-white italic">
                  {editing ? "Firmayı Düzenle" : "Yeni Firma Ekle"}
                </h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white text-lg">&times;</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Firma Adı *</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Tür</label>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PartnerFirmType })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary/40 focus:outline-none">
                    <option value="branch">Şube</option>
                    <option value="partner">İş Ortağı</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Kategori</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as PartnerFirmCategory })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-primary/40 focus:outline-none">
                    <option value="mimarlik_ofisi">Mimarlık Ofisi</option>
                    <option value="muteahhit">Müteahhit</option>
                    <option value="emlakci">Emlakçı</option>
                    <option value="diger">Diğer</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Açıklama</label>
                  <textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" rows={2} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Adres</label>
                  <div className="flex gap-2">
                    <input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="flex-1 rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" />
                    <button type="button" onClick={async () => {
                      const q = encodeURIComponent([form.address, form.city, form.country].filter(Boolean).join(", "));
                      if (!q) return;
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`);
                        const data = await res.json();
                        if (data?.[0]) {
                          setForm((p) => ({ ...p, latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }));
                        }
                      } catch {}
                    }} className="px-3 py-2 bg-primary/10 border border-primary/20 rounded-sm text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/20 transition-all whitespace-nowrap">
                      Koordinat Bul
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Şehir</label>
                  <input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Ülke</label>
                  <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Enlem</label>
                  <input type="number" step="any" value={form.latitude ?? ""} onChange={(e) => setForm({ ...form, latitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Boylam</label>
                  <input type="number" step="any" value={form.longitude ?? ""} onChange={(e) => setForm({ ...form, longitude: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Telefon</label>
                  <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">E-posta</label>
                  <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Web Sitesi</label>
                  <input type="url" value={form.website || ""} onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mb-1.5">Sosyal Medya (JSON)</label>
                  <input value={JSON.stringify(form.socialMedia)} onChange={(e) => {
                    try { setForm({ ...form, socialMedia: JSON.parse(e.target.value) }); } catch {}
                  }}
                    className="w-full rounded-sm border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-700 focus:border-primary/40 focus:outline-none font-mono text-[11px]" />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary" />
                  <span className="text-[10px] font-sans uppercase tracking-widest text-gray-400">Aktif</span>
                </label>
                <div className="flex-1" />
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={saving || !form.name.trim()}
                  className="px-6 py-2 bg-primary text-black rounded-sm text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50">
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
