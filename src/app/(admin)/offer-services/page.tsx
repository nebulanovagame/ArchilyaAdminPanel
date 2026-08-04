"use client";

import { useEffect, useState } from "react";
import { Tags, Plus, Loader2, Pencil, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listOfferServices,
  createOfferService,
  updateOfferService,
  deleteOfferService,
} from "@/lib/api/admin-client";
import type { OfferServiceRecord } from "@/lib/api/types";

const CATEGORIES = [
  { value: "arch", label: "Mimari" },
  { value: "vr", label: "VR" },
];

type FormData = {
  name: string;
  description: string;
  basePrice: string;
  perM2: string;
  minPrice: string;
  category: "arch" | "vr";
  group: string;
  defaultM2: string;
  guarantee: boolean;
  badge: string;
  features: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  description: "",
  basePrice: "0",
  perM2: "",
  minPrice: "",
  category: "arch",
  group: "",
  defaultM2: "100",
  guarantee: false,
  badge: "",
  features: "",
};

export default function OfferServicesPage() {
  const [services, setServices] = useState<OfferServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadServices = () => {
    setLoading(true);
    setError(null);
    listOfferServices()
      .then(setServices)
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Veri yuklenemedi";
        setError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    listOfferServices()
      .then(setServices)
      .catch((e: unknown) => {
        const message = e instanceof Error ? e.message : "Veri yuklenemedi";
        setError(message);
      })
      .finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (svc: OfferServiceRecord) => {
    setForm({
      name: svc.name,
      description: svc.description,
      basePrice: String(svc.basePrice),
      perM2: svc.perM2 != null ? String(svc.perM2) : "",
      minPrice: svc.minPrice != null ? String(svc.minPrice) : "",
      category: svc.category,
      group: svc.group,
      defaultM2: String(svc.defaultM2),
      guarantee: svc.guarantee,
      badge: svc.badge ?? "",
      features: svc.features.join(", "),
    });
    setEditingId(svc.id);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Hizmet adi zorunludur");
      return;
    }
    if (!form.group.trim()) {
      setFormError("Grup zorunludur");
      return;
    }

    const basePrice = Number(form.basePrice);
    if (Number.isNaN(basePrice) || basePrice < 0) {
      setFormError("Taban fiyat gecersiz");
      return;
    }

    const perM2 = form.perM2 !== "" ? Number(form.perM2) : null;
    if (perM2 !== null && (Number.isNaN(perM2) || perM2 < 0)) {
      setFormError("m2 fiyati gecersiz");
      return;
    }

    const minPrice = form.minPrice !== "" ? Number(form.minPrice) : null;
    if (minPrice !== null && (Number.isNaN(minPrice) || minPrice < 0)) {
      setFormError("Minimum fiyat gecersiz");
      return;
    }

    const defaultM2 = Number(form.defaultM2);
    if (Number.isNaN(defaultM2) || defaultM2 < 1 || defaultM2 > 10000) {
      setFormError("Varsayilan m2 1-10000 arasinda olmalidir");
      return;
    }

    const features = form.features
      .split(",")
      .map((f) => f.trim())
      .filter(Boolean);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      basePrice,
      perM2,
      minPrice,
      category: form.category,
      group: form.group.trim(),
      defaultM2,
      guarantee: form.guarantee,
      badge: form.badge.trim() || null,
      features,
    };

    setSaving(true);
    setFormError(null);

    try {
      if (editingId) {
        await updateOfferService(editingId, payload);
      } else {
        await createOfferService(payload);
      }
      setFormOpen(false);
      resetForm();
      loadServices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Islem basarisiz";
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (svc: OfferServiceRecord) => {
    setToggling(svc.id);
    try {
      await updateOfferService(svc.id, { isActive: !svc.isActive });
      loadServices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Durum degistirilemedi";
      alert(message);
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (svc: OfferServiceRecord) => {
    if (!window.confirm(`"${svc.name}" hizmetini pasif yapmak istediginize emin misiniz?`)) return;
    setDeleting(svc.id);
    try {
      await deleteOfferService(svc.id);
      loadServices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Silme islemi basarisiz";
      alert(message);
    } finally {
      setDeleting(null);
    }
  };

  const formatPrice = (val: number) =>
    val.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  if (loading) return <LoadingState message="Teklif katalogu yukleniyor..." />;
  if (error)
    return (
      <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">
            Admin Panel
          </p>
          <h1 className="font-serif text-3xl text-white italic">Teklif Katalogu</h1>
        </div>
        <Button onClick={formOpen ? () => { setFormOpen(false); resetForm(); } : openCreate}>
          {formOpen ? (
            "Kapat"
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" /> Yeni Hizmet Ekle
            </>
          )}
        </Button>
      </div>

      {/* Create / Edit Form */}
      {formOpen && (
        <div className="glass-card rounded-sm overflow-hidden p-5">
          <h2 className="text-sm font-sans font-medium text-white mb-4">
            {editingId ? "Hizmeti Duzenle" : "Yeni Hizmet Ekle"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Name */}
              <div>
                <label htmlFor="svc-name" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                  Hizmet Adi *
                </label>
                <input
                  id="svc-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Orn: 3D Mimari Gorsellestirme"
                  maxLength={200}
                  className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Group */}
              <div>
                <label htmlFor="svc-group" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                  Grup *
                </label>
                <input
                  id="svc-group"
                  value={form.group}
                  onChange={(e) => setForm({ ...form, group: e.target.value })}
                  placeholder="Orn: gorsellestirme"
                  maxLength={50}
                  className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="svc-category" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                  Kategori
                </label>
                <select
                  id="svc-category"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as "arch" | "vr" })}
                  className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Base Price */}
              <div>
                <label htmlFor="svc-base-price" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                  Taban Fiyat (TRY)
                </label>
                <input
                  id="svc-base-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                  className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Per m2 */}
              <div>
                <label htmlFor="svc-per-m2" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                  m2 Fiyati (opsiyonel)
                </label>
                <input
                  id="svc-per-m2"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.perM2}
                  onChange={(e) => setForm({ ...form, perM2: e.target.value })}
                  placeholder="Bos birakin"
                  className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Min Price */}
              <div>
                <label htmlFor="svc-min-price" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                  Minimum Fiyat (opsiyonel)
                </label>
                <input
                  id="svc-min-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minPrice}
                  onChange={(e) => setForm({ ...form, minPrice: e.target.value })}
                  placeholder="Bos birakin"
                  className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Default m2 */}
              <div>
                <label htmlFor="svc-default-m2" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                  Varsayilan m2
                </label>
                <input
                  id="svc-default-m2"
                  type="number"
                  min="1"
                  max="10000"
                  value={form.defaultM2}
                  onChange={(e) => setForm({ ...form, defaultM2: e.target.value })}
                  className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Badge */}
              <div>
                <label htmlFor="svc-badge" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                  Rozet (opsiyonel)
                </label>
                <input
                  id="svc-badge"
                  value={form.badge}
                  onChange={(e) => setForm({ ...form, badge: e.target.value })}
                  placeholder="Orn: Populer"
                  maxLength={100}
                  className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Guarantee checkbox */}
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.guarantee}
                    onChange={(e) => setForm({ ...form, guarantee: e.target.checked })}
                    className="w-4 h-4 accent-primary"
                  />
                  <span className="text-sm text-gray-300">Garanti dahil</span>
                </label>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="svc-desc" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                Aciklama
              </label>
              <textarea
                id="svc-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Hizmet hakkinda kisa aciklama"
                className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              />
            </div>

            {/* Features */}
            <div>
              <label htmlFor="svc-features" className="block text-[10px] font-sans font-medium uppercase tracking-widest text-gray-400 mb-1.5">
                Ozellikler (virgul ile ayirin)
              </label>
              <textarea
                id="svc-features"
                value={form.features}
                onChange={(e) => setForm({ ...form, features: e.target.value })}
                rows={2}
                placeholder="Orn: 4K cikis, Revizyon hakki, 3 gun teslim"
                className="w-full bg-[#0a0c0f] border border-white/10 rounded-sm px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              />
            </div>

            {formError && (
              <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">
                {formError}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {saving ? "Kaydediliyor..." : editingId ? "Guncelle" : "Ekle"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setFormOpen(false); resetForm(); }}
              >
                Iptal
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      {services.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="Hizmet bulunamadi"
          description="Yukaridaki butonu kullanarak yeni hizmet ekleyin"
        />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-[10px] font-sans uppercase tracking-widest text-gray-500">
              Toplam {services.length} hizmet
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad</TableHead>
                  <TableHead>Grup</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Taban Fiyat</TableHead>
                  <TableHead>m2 Fiyat</TableHead>
                  <TableHead>Min Fiyat</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Islemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((svc) => (
                  <TableRow key={svc.id}>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-2">
                        {svc.name}
                        {svc.badge && <Badge variant="info">{svc.badge}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">{svc.group}</TableCell>
                    <TableCell>
                      <Badge variant={svc.category === "vr" ? "warning" : "default"}>
                        {svc.category === "vr" ? "VR" : "Mimari"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatPrice(svc.basePrice)} ₺</TableCell>
                    <TableCell className="text-sm">
                      {svc.perM2 != null ? `${formatPrice(svc.perM2)} ₺` : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {svc.minPrice != null ? `${formatPrice(svc.minPrice)} ₺` : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={svc.isActive ? "success" : "danger"}>
                        {svc.isActive ? "Aktif" : "Pasif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(svc)}
                          title="Duzenle"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={toggling === svc.id}
                          onClick={() => handleToggle(svc)}
                          title={svc.isActive ? "Pasif yap" : "Aktif yap"}
                        >
                          {toggling === svc.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : svc.isActive ? (
                            <ToggleRight className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-3 h-3 text-gray-500" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={deleting === svc.id}
                          onClick={() => handleDelete(svc)}
                          title="Pasif yap (sil)"
                        >
                          {deleting === svc.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3 text-red-400" />
                          )}
                        </Button>
                      </div>
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
