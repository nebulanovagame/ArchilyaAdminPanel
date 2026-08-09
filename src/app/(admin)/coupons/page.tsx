"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Ticket,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Loader2,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardValue } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponStats,
  listCouponRedemptions,
} from "@/lib/api/admin-client";
import type { CouponRecord, CouponStats, CouponDiscountType, CouponRedemptionRecord } from "@/lib/api/types";

// ─── Modal form type ────────────────────────────────────

type CouponFormData = {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  discountDurationMonths: number;
  maxUses: number;
  expiresAt: string;
  appliesToPlans: string[];
  isActive: boolean;
};

const EMPTY_FORM: CouponFormData = {
  code: "",
  description: "",
  discountType: "percent",
  discountValue: 0,
  discountDurationMonths: 12,
  maxUses: -1,
  expiresAt: "",
  appliesToPlans: [],
  isActive: true,
};

const PLAN_OPTIONS = [
  { value: "solo", label: "Solo" },
  { value: "pro", label: "Pro" },
  { value: "studio", label: "Studio" },
  { value: "emlak_beta", label: "Emlak Beta" },
];

// ─── Helpers ────────────────────────────────────────────

function formatDiscount(type: CouponDiscountType, value: number): string {
  if (type === "percent") return `%${value}`;
  return `${value.toLocaleString("tr-TR")}₺`;
}

function getCouponStatus(
  coupon: CouponRecord,
): { label: string; variant: "success" | "warning" | "danger" } {
  if (!coupon.isActive) return { label: "Pasif", variant: "warning" };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { label: "Süresi Doldu", variant: "danger" };
  }
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    return { label: "Tükendi", variant: "danger" };
  }
  return { label: "Aktif", variant: "success" };
}

function formatUsage(coupon: CouponRecord): string {
  if (coupon.maxUses === -1) return `${coupon.usedCount}/Sınırsız`;
  return `${coupon.usedCount}/${coupon.maxUses}`;
}

// ─── Page Component ─────────────────────────────────────

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<CouponRecord[]>([]);
  const [stats, setStats] = useState<CouponStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponRecord | null>(null);
  const [formData, setFormData] = useState<CouponFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Redemptions
  const [redemptions, setRedemptions] = useState<CouponRedemptionRecord[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [couponList, statsData] = await Promise.all([
        listCoupons(),
        getCouponStats(),
      ]);
      setCoupons(couponList);
      setStats(statsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    listCoupons()
      .then(setCoupons)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    getCouponStats()
      .then(setStats)
      .catch(() => {});
    listCouponRedemptions()
      .then(setRedemptions)
      .catch(() => {})
      .finally(() => setRedemptionsLoading(false));
  }, []);

  // ─── Modal handlers ─────────────────────────────────

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData(EMPTY_FORM);
    setSaveError(null);
    setShowModal(true);
  };

  const openEditModal = (coupon: CouponRecord) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountDurationMonths: coupon.discountDurationMonths,
      maxUses: coupon.maxUses,
      expiresAt: coupon.expiresAt ? coupon.expiresAt.slice(0, 10) : "",
      appliesToPlans: coupon.appliesToPlans,
      isActive: coupon.isActive,
    });
    setSaveError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCoupon(null);
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, {
          code: formData.code.toUpperCase(),
          description: formData.description,
          discountType: formData.discountType,
          discountValue: formData.discountValue,
          discountDurationMonths: formData.discountDurationMonths,
          maxUses: formData.maxUses,
          expiresAt: formData.expiresAt || null,
          appliesToPlans: formData.appliesToPlans,
          isActive: formData.isActive,
        });
      } else {
        await createCoupon({
          code: formData.code.toUpperCase(),
          description: formData.description,
          discountType: formData.discountType,
          discountValue: formData.discountValue,
          discountDurationMonths: formData.discountDurationMonths,
          maxUses: formData.maxUses,
          expiresAt: formData.expiresAt || null,
          appliesToPlans: formData.appliesToPlans,
          isActive: formData.isActive,
        });
      }
      closeModal();
      await loadData();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Kaydetme hatası");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (coupon: CouponRecord) => {
    try {
      await updateCoupon(coupon.id, { isActive: !coupon.isActive });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Güncelleme hatası");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCoupon(id);
      setDeletingId(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Silme hatası");
    }
  };

  const togglePlan = (plan: string) => {
    setFormData((prev) => ({
      ...prev,
      appliesToPlans: prev.appliesToPlans.includes(plan)
        ? prev.appliesToPlans.filter((p) => p !== plan)
        : [...prev.appliesToPlans, plan],
    }));
  };

  // ─── Render ──────────────────────────────────────────

  if (loading) return <LoadingState message="Kuponlar yükleniyor..." />;

  if (error) {
    return (
      <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  const statCards = [
    { title: "Toplam Kupon", value: stats?.totalCoupons ?? 0, desc: "Sistemdeki toplam kupon", icon: Ticket },
    { title: "Aktif Kupon", value: stats?.activeCoupons ?? 0, desc: "Kullanılabilir kuponlar", icon: Ticket },
    { title: "Toplam Kullanım", value: stats?.totalRedemptions ?? 0, desc: "Kupon kullanım sayısı", icon: Ticket },
    { title: "Süresi Dolanlar", value: stats?.expiredCoupons ?? 0, desc: "Süresi dolmuş kuponlar", icon: Ticket },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-primary text-[10px] uppercase tracking-[0.25em] font-sans mb-1">Admin Panel</p>
          <h1 className="font-serif text-3xl text-white italic">Kuponlar</h1>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-1.5" />
          Yeni Kupon
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} hover>
              <CardHeader className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.desc}</CardDescription>
                </div>
                <div className="rounded-sm border border-primary/20 bg-primary/10 p-2.5 text-primary">
                  <Icon className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardValue className="text-3xl">
                {(card.value as number).toLocaleString("tr-TR")}
              </CardValue>
            </Card>
          );
        })}
      </div>

      {/* Table */}
      {coupons.length === 0 ? (
        <EmptyState icon={Ticket} title="Kupon bulunamadı" />
      ) : (
        <div className="glass-card rounded-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kod</TableHead>
                <TableHead>İndirim</TableHead>
                <TableHead>Süre</TableHead>
                <TableHead>Kullanım</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Bitiş Tarihi</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => {
                const status = getCouponStatus(coupon);
                return (
                  <TableRow key={coupon.id}>
                    <TableCell>
                      <span className="font-mono text-sm font-medium text-white">{coupon.code}</span>
                      {coupon.description && (
                        <p className="text-[11px] text-gray-500 mt-0.5 max-w-[200px] truncate">
                          {coupon.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-primary">
                        {formatDiscount(coupon.discountType, coupon.discountValue)}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{coupon.discountDurationMonths} ay</TableCell>
                    <TableCell className="text-sm">{formatUsage(coupon)}</TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-[11px] text-gray-500">
                      {coupon.expiresAt
                        ? new Date(coupon.expiresAt).toLocaleDateString("tr-TR")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(coupon)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleToggleActive(coupon)}
                        >
                          {coupon.isActive ? (
                            <ToggleRight className="w-3 h-3 text-green-400" />
                          ) : (
                            <ToggleLeft className="w-3 h-3 text-gray-500" />
                          )}
                        </Button>
                        {deletingId === coupon.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => handleDelete(coupon.id)}
                            >
                              <Loader2 className="w-3 h-3 animate-spin" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setDeletingId(null)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setDeletingId(coupon.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Son Kullanımlar */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-primary" />
          <h2 className="font-serif text-xl text-white italic">Son Kullanımlar</h2>
        </div>
        {redemptionsLoading ? (
          <div className="glass-card rounded-sm px-4 py-6 text-center text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin inline-block mr-1.5" />
            Yükleniyor...
          </div>
        ) : redemptions.length === 0 ? (
          <div className="glass-card rounded-sm px-4 py-6 text-center text-sm text-gray-500">
            Henüz kupon kullanımı bulunmuyor.
          </div>
        ) : (
          <div className="glass-card rounded-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Kullanıcı</TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead>İndirim</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.email}</TableCell>
                    <TableCell className="text-sm text-gray-400">
                      {r.displayName || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-medium text-white">{r.code}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium text-primary">
                        {formatDiscount(r.discountType, r.discountValue)}
                      </span>
                    </TableCell>
                    <TableCell className="text-[11px] text-gray-500">
                      {new Date(r.redeemedAt).toLocaleDateString("tr-TR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/60" onClick={closeModal} />
          <div className="relative bg-[#1a1c23] border border-white/10 rounded-sm w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h2 className="font-serif text-xl text-white italic">
                {editingCoupon ? "Kupon Düzenle" : "Yeni Kupon"}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {saveError && (
                <div className="rounded-sm border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                  {saveError}
                </div>
              )}

              {/* Code */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-sans mb-1.5">
                  Kupon Kodu *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                  placeholder="ORN: YAZ2025"
                  maxLength={50}
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-sans mb-1.5">
                  Açıklama
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Kupon açıklaması..."
                  rows={2}
                  maxLength={1000}
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50 resize-none"
                />
              </div>

              {/* Discount Type + Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-sans mb-1.5">
                    İndirim Tipi *
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, discountType: e.target.value as CouponDiscountType }))
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  >
                    <option value="percent">Yüzde (%)</option>
                    <option value="fixed">Sabit TL (₺)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-sans mb-1.5">
                    İndirim Değeri *
                  </label>
                  <input
                    type="number"
                    value={formData.discountValue || ""}
                    onChange={(e) => setFormData((p) => ({ ...p, discountValue: Number(e.target.value) }))}
                    placeholder={formData.discountType === "percent" ? "20" : "500"}
                    min={0}
                    max={formData.discountType === "percent" ? 100 : undefined}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              {/* Duration + Max Uses */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-sans mb-1.5">
                    Süre (Ay)
                  </label>
                  <input
                    type="number"
                    value={formData.discountDurationMonths}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, discountDurationMonths: Number(e.target.value) }))
                    }
                    min={1}
                    max={120}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-sans mb-1.5">
                    Maks Kullanım (-1=Sınırsız)
                  </label>
                  <input
                    type="number"
                    value={formData.maxUses}
                    onChange={(e) => setFormData((p) => ({ ...p, maxUses: Number(e.target.value) }))}
                    min={-1}
                    className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                  />
                </div>
              </div>

              {/* Expires At */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-sans mb-1.5">
                  Bitiş Tarihi
                </label>
                <input
                  type="date"
                  value={formData.expiresAt}
                  onChange={(e) => setFormData((p) => ({ ...p, expiresAt: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                />
              </div>

              {/* Applies To Plans */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-sans mb-1.5">
                  Plan Kısıtı (Boş=Tümü)
                </label>
                <div className="flex flex-wrap gap-2">
                  {PLAN_OPTIONS.map((plan) => {
                    const selected = formData.appliesToPlans.includes(plan.value);
                    return (
                      <button
                        key={plan.value}
                        type="button"
                        onClick={() => togglePlan(plan.value)}
                        className={`px-3 py-1.5 rounded-sm text-xs font-sans border transition-colors ${
                          selected
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                        }`}
                      >
                        {plan.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, isActive: !p.isActive }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    formData.isActive ? "bg-primary" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      formData.isActive ? "translate-x-5" : ""
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-300">
                  {formData.isActive ? "Aktif" : "Pasif"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5">
              <Button variant="secondary" onClick={closeModal}>
                İptal
              </Button>
              <Button onClick={handleSave} disabled={saving || !formData.code.trim()}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : null}
                {editingCoupon ? "Güncelle" : "Oluştur"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
