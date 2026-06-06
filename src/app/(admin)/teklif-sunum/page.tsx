"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Sparkles, Check, Crown, Printer, ArrowLeft, Plus, Minus,
  LayoutGrid, Layers, Trees, Cpu, Film,
  BadgeCheck, Glasses,   ShieldHalf,
} from "lucide-react";

import {
  ARCH_SERVICES, VR_SERVICES, ALL_SERVICES,
  fmt, calcServicePrice, unitSavingPct, getServiceM2,
  DISTRIBUTION_COLORS, type Service,
} from "@/lib/teklif-data";

/* ─── CSS Animations ─── */

const ANIM_STYLES = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes reveal {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .anim-fade-in-up {
    animation: fadeInUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    opacity: 0;
  }
  .anim-fade-in {
    animation: fadeIn 0.5s ease forwards;
    opacity: 0;
  }
  .panel-sheen {
    position: relative;
    overflow: hidden;
  }
  .panel-sheen::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.06), transparent 28%, transparent 70%, rgba(198,168,124,0.06));
    pointer-events: none;
    z-index: 0;
  }
  .panel-sheen > * { position: relative; z-index: 1; }
  .scrollbar-thin::-webkit-scrollbar { height: 4px; }
  .scrollbar-thin::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 2px; }
  .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(198,168,124,0.3); border-radius: 2px; }
  .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(198,168,124,0.5); }
  .noise-overlay::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.04;
    background-image: radial-gradient(rgba(255,255,255,0.4) 0.7px, transparent 0.7px);
    background-size: 14px 14px;
    pointer-events: none;
    mix-blend-mode: soft-light;
  }
`;

/* ─── Icon Map ─── */

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  LayoutGrid, Layers, Trees, Cpu, Film, BadgeCheck, Glasses,
  Sparkles, Check, Crown, ShieldHalf, ArrowLeft, Printer, Plus, Minus,
};

/* ─── Icon Component ─── */

function ServiceIcon({ category, className }: { category: string; className?: string }) {
  const Icon = ICON_MAP[category === 'vr' ? 'Glasses' : 'LayoutGrid'] || Sparkles;
  return <Icon className={className} />;
}

/* ─── Helpers ─── */

function initM2Map(): Record<string, number> {
  const map: Record<string, number> = {};
  ALL_SERVICES.forEach((s) => { map[s.id] = s.defaultM2; });
  return map;
}

/* ─── Sub-components ─── */

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: 'primary' | 'emerald' }) {
  const borderCls = accent === 'primary' ? 'border-primary/20' : accent === 'emerald' ? 'border-emerald-400/25' : 'border-white/[0.06]';
  const textCls = accent === 'primary' ? 'text-primary' : accent === 'emerald' ? 'text-emerald-400' : 'text-white';
  return (
    <div className={`panel-sheen rounded-sm border ${borderCls} bg-surface/60 px-4 py-4 backdrop-blur-xl transition-all duration-300 hover:border-white/15`}>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">{label}</p>
      <p className={`text-2xl font-serif tracking-tight ${textCls}`}>{value}</p>
      {sub && <p className="text-[9px] text-gray-500 mt-1 font-medium leading-tight">{sub}</p>}
    </div>
  );
}

function ServicePreviewCard({ service, m2, index, specialPrice }: { service: Service; m2: number; index: number; specialPrice: number | null }) {
  const formulaPrice = calcServicePrice(service.basePrice, m2);
  const isCustom = m2 >= 5000;
  const effectiveTotal = specialPrice != null ? specialPrice : (formulaPrice?.total ?? 0);
  const effectiveMember = specialPrice != null ? Math.round(specialPrice * 0.8) : (formulaPrice?.member ?? 0);

  return (
    <div
      className="anim-fade-in-up panel-sheen rounded-sm border border-white/[0.06] bg-surface/55 p-5 md:p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-all duration-500 ease-out hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_32px_100px_rgba(0,0,0,0.5)]"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1">
        <Sparkles className="h-3 w-3 text-primary" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-primary">
          {service.category === 'vr' ? (service.badge || 'VR') : 'Hizmet'}
        </span>
      </div>

      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-primary/20 bg-primary/10 shadow-[0_0_12px_rgba(198,168,124,0.1)]">
          <ServiceIcon category={service.category} className="h-4 w-4 text-primary" />
        </div>
        <h2 className="text-xl italic leading-tight text-white">{service.name}</h2>
      </div>

      <p className="mb-4 text-xs leading-relaxed text-gray-400/80">{service.description}</p>

      {isCustom ? (
        <div className="mb-3 rounded-sm border border-white/[0.06] bg-black/30 px-4 py-4 backdrop-blur-sm">
          <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500 font-semibold">Özel Proje</p>
          <p className="mt-1 text-base font-serif text-primary font-bold uppercase tracking-wider">İletişime Geçin</p>
        </div>
      ) : formulaPrice ? (
        specialPrice != null ? (
          <>
            <div className="mb-3 rounded-sm border border-amber-400/25 bg-gradient-to-br from-amber-400/[0.08] via-amber-400/[0.03] to-transparent p-4 shadow-[0_0_25px_rgba(251,191,36,0.06)]">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 mb-3">
                <Crown className="h-2.5 w-2.5 text-amber-400" />
                <span className="text-[8px] font-bold uppercase tracking-[0.22em] text-amber-400">Özel Fiyat</span>
              </div>
              <div className="text-center mb-3">
                <p className="text-[9px] text-gray-500/60 uppercase tracking-wider font-medium mb-0.5">Standart Fiyat</p>
                <p className="text-xl font-serif text-gray-500 line-through decoration-red-400/40">{fmt(formulaPrice.total)} TL</p>
                <div className="flex items-center justify-center gap-2 my-2">
                  <span className="h-px w-6 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                  <span className="text-[8px] uppercase tracking-[0.25em] text-amber-400/60 font-bold">Özel</span>
                  <span className="h-px w-6 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
                </div>
                <p className="text-2xl font-serif text-amber-400 font-bold drop-shadow-[0_0_12px_rgba(251,191,36,0.2)]">{fmt(specialPrice)} TL</p>
              </div>
              {specialPrice < formulaPrice.total && (
                <div className="rounded-sm bg-emerald-400/10 border border-emerald-400/20 px-3 py-1.5 text-center">
                  <p className="text-[9px] font-bold text-emerald-400">Müşteri <span className="text-sm font-serif">{fmt(formulaPrice.total - specialPrice)} TL</span> tasarruf eder</p>
                </div>
              )}
            </div>
            <p className="text-[9px] text-gray-500 mb-3 tracking-wider font-medium">{fmt(m2)} m² · {fmt(effectiveTotal > 0 ? Math.round(effectiveTotal / m2) : 0)} TL/m²</p>
            <div className="mb-4 rounded-sm border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent px-4 py-3 shadow-[0_0_15px_rgba(198,168,124,0.06)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Abone Bedeli</p>
              <p className="mt-1 text-xl font-serif text-primary drop-shadow-[0_0_8px_rgba(198,168,124,0.2)]">{fmt(effectiveMember)} TL</p>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 rounded-sm border border-white/[0.06] bg-black/30 px-4 py-4 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500 font-semibold">Standart Bedel</p>
              <p className="mt-1 text-2xl font-serif text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.1)]">{fmt(formulaPrice.total)} TL</p>
            </div>
            <p className="text-[9px] text-gray-500 mb-3 tracking-wider font-medium">
              {fmt(m2)} m² · {fmt(formulaPrice.unit)} TL/m²
              {unitSavingPct(m2) > 0 && <span className="text-emerald-400 ml-1">(-%{unitSavingPct(m2)})</span>}
            </p>
            <div className="mb-4 rounded-sm border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent px-4 py-3 shadow-[0_0_15px_rgba(198,168,124,0.06)]">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Abone Bedeli</p>
              <p className="mt-1 text-xl font-serif text-primary drop-shadow-[0_0_8px_rgba(198,168,124,0.2)]">{fmt(formulaPrice.member)} TL</p>
            </div>
          </>
        )
      ) : null}

      <ul className="space-y-1.5 text-[11px] text-gray-300/90">
        {formulaPrice && (
          <>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              Taban fiyat: <strong className="text-gray-100">{fmt(service.basePrice)} TL</strong> · {fmt(m2)} m²
            </li>
            <li className="flex items-start gap-2">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              Abone indirimi: <strong className="text-primary">%20</strong>
            </li>
            {specialPrice != null && (
              <li className="flex items-start gap-2">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                Özel fiyatlandırma uygulanmıştır
              </li>
            )}
          </>
        )}
        {service.guarantee && (
          <li className="flex items-start gap-2 text-emerald-400">
            <ShieldHalf className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="font-semibold">%50 iade garantisi</span>
          </li>
        )}
      </ul>
    </div>
  );
}

function ServiceSelectCard({
  service, m2, selected, onToggle, onM2Change, specialPrice, onSpecialPriceChange,
}: {
  service: Service; m2: number; selected: boolean;
  onToggle: () => void; onM2Change: (val: number) => void;
  specialPrice: number | null; onSpecialPriceChange: (val: number | null) => void;
}) {
  const formulaPrice = calcServicePrice(service.basePrice, m2);
  const effectiveTotal = specialPrice != null ? specialPrice : (formulaPrice?.total ?? 0);
  const effectiveMember = specialPrice != null ? Math.round(specialPrice * 0.8) : (formulaPrice?.member ?? 0);

  return (
    <div
      className={`relative rounded-sm border p-5 md:p-5 transition-all duration-400 ease-out backdrop-blur-sm ${
        selected
          ? 'border-primary/35 bg-primary/[0.05] shadow-[0_0_25px_rgba(198,168,124,0.1)]'
          : 'border-white/[0.06] bg-white/[0.015] hover:border-white/20 hover:bg-white/[0.03]'
      }`}
    >
      {/* Header row: click to toggle */}
      <button onClick={onToggle} className="w-full text-left flex items-start gap-3.5 mb-0 cursor-pointer">
        {selected && (
          <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-[0_0_10px_rgba(198,168,124,0.3)]">
            <Check className="h-3 w-3 text-black" />
          </div>
        )}
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border transition-colors duration-300 ${
          selected ? 'border-primary/30 bg-primary/10 text-primary shadow-[0_0_12px_rgba(198,168,124,0.08)]' : 'border-white/10 bg-white/[0.03] text-gray-500'
        }`}>
          <ServiceIcon category={service.category} className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-serif text-white italic leading-snug">{service.name}</h3>
            <span className="shrink-0 text-[10px] text-gray-500/70 font-bold tracking-wider">{fmt(service.basePrice)} TL</span>
          </div>
          <p className="text-[11px] text-gray-500/80 leading-relaxed mt-1 line-clamp-2">{service.description}</p>
          {service.guarantee && (
            <div className="flex items-center gap-1.5 mt-2">
              <ShieldHalf className="h-3 w-3 text-emerald-400" />
              <span className="text-[9px] text-emerald-400 tracking-wider uppercase font-bold">%50 İade Garantisi</span>
            </div>
          )}
        </div>
      </button>

      {/* m² input — only visible when selected */}
      {selected && (
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
          {/* m² row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onM2Change(Math.max(10, m2 - 10)); }}
                className="flex h-7 w-7 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white hover:border-white/30 transition-all duration-200 cursor-pointer"
              >
                <Minus className="h-3 w-3" />
              </button>
              <div className="relative">
                <input
                  type="number"
                  value={m2}
                  min={10}
                  max={5000}
                  step={10}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const v = parseInt(e.target.value) || 10;
                    onM2Change(Math.min(5000, Math.max(10, v)));
                  }}
                  className="w-20 text-center bg-white/5 border border-white/10 rounded-sm px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-primary/50 focus:bg-primary/[0.04] transition-all duration-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-500 pointer-events-none font-medium">m²</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onM2Change(Math.min(5000, m2 + 10)); }}
                className="flex h-7 w-7 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white hover:border-white/30 transition-all duration-200 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {formulaPrice && (
              <div className="text-right">
                <p className="text-[11px] font-serif text-white">{fmt(effectiveTotal)} TL</p>
                <p className="text-[10px] text-primary font-bold tracking-wider">Abone: {fmt(effectiveMember)} TL</p>
              </div>
            )}
          </div>

          {/* Özel fiyat bölümü */}
          <div className="pt-2">
            {specialPrice != null && formulaPrice ? (
              /* ÖZEL FİYAT AKTİF — karşılaştırmalı premium kart */
              <div className="rounded-sm border border-amber-400/30 bg-gradient-to-br from-amber-400/[0.1] via-amber-400/[0.04] to-transparent p-4 space-y-3 shadow-[0_0_25px_rgba(251,191,36,0.08)]">
                {/* Header: taç + Özel Fiyat + Kaldır butonu */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20">
                      <Crown className="h-3 w-3 text-amber-400" />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400">Özel Fiyat</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onSpecialPriceChange(null); }}
                    className="text-[8px] uppercase tracking-wider text-gray-500 hover:text-red-400 transition-colors cursor-pointer font-bold"
                  >
                    ✕ Kaldır
                  </button>
                </div>

                {/* ESPİRİ: Eski fiyat gözüne gözüne */}
                <div className="text-center space-y-1">
                  <p className="text-[10px] text-gray-500/70 uppercase tracking-wider font-medium">Standart Fiyat</p>
                  <p className="text-2xl font-serif text-gray-500 line-through decoration-2 decoration-red-400/40">{fmt(formulaPrice.total)} TL</p>
                  <div className="flex items-center justify-center gap-2 text-[10px] text-amber-400/70">
                    <span className="h-px w-6 bg-amber-400/30" />
                    <span>Özel İndirim</span>
                    <span className="h-px w-6 bg-amber-400/30" />
                  </div>
                  <p className="text-3xl font-serif text-amber-400 font-bold drop-shadow-[0_0_15px_rgba(251,191,36,0.2)]">{fmt(specialPrice)} TL</p>
                </div>

                {/* Input alanı */}
                <div className="flex items-center gap-2 bg-black/30 rounded-sm border border-amber-400/20 px-3 py-2">
                  <span className="text-[9px] uppercase tracking-wider text-amber-400/70 font-bold">Fiyat</span>
                  <input
                    type="number"
                    value={specialPrice}
                    min={0}
                    step={100}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onSpecialPriceChange(parseInt(e.target.value) || 0)}
                    className="flex-1 bg-transparent text-right text-sm font-mono text-amber-400 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="text-[9px] text-amber-400/70 font-bold">TL</span>
                </div>

                {/* Tasarruf vurgusu */}
                {specialPrice < formulaPrice.total && (
                  <div className="rounded-sm bg-emerald-400/10 border border-emerald-400/20 px-3 py-2 text-center">
                    <p className="text-[11px] font-bold text-emerald-400">
                      Müşteri <span className="text-base font-serif">{fmt(formulaPrice.total - specialPrice)} TL</span> tasarruf eder
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* ÖZEL FİYAT KAPALI — davetkar buton */
              <button
                onClick={(e) => { e.stopPropagation(); onSpecialPriceChange(formulaPrice?.total ?? service.basePrice); }}
                className="w-full flex items-center justify-center gap-2.5 text-[9px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-sm border border-dashed border-white/10 text-gray-500 hover:text-amber-400 hover:border-amber-400/30 hover:bg-amber-400/[0.04] transition-all duration-200 cursor-pointer group"
              >
                <Crown className="h-3.5 w-3.5 group-hover:text-amber-400 transition-colors" />
                <span>Özel Fiyat Belirle</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Divider({ label, color }: { label: string; color: 'primary' | 'amber' }) {
  const isAmber = color === 'amber';
  const lineCls = isAmber ? 'via-amber-400/20 to-amber-400/35' : 'via-primary/20 to-primary/35';
  const borderCls = isAmber ? 'border-amber-400/20' : 'border-primary/20';
  const bgCls = isAmber ? 'bg-amber-400/[0.07]' : 'bg-primary/[0.07]';
  const textCls = isAmber ? 'text-amber-400' : 'text-primary';
  const dotCls = isAmber ? 'bg-amber-400' : 'bg-primary';

  return (
    <div className="relative flex items-center gap-4 my-12 md:my-16">
      <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${lineCls}`} />
      <div className={`flex items-center gap-3 px-5 py-2 border ${borderCls} rounded-sm ${bgCls} shrink-0 backdrop-blur-xl shadow-[0_0_20px_rgba(198,168,124,0.04)]`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
        <span className={`text-[10px] font-bold uppercase tracking-[0.32em] ${textCls}`}>{label}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
      </div>
      <div className={`h-px flex-1 bg-gradient-to-l from-transparent ${lineCls}`} />
    </div>
  );
}

/* ─── Main Page ─── */

export default function TeklifSunumPage() {
  const [serviceM2s, setServiceM2s] = useState<Record<string, number>>(initM2Map);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'builder' | 'preview'>('builder');
  const [specialPrices, setSpecialPrices] = useState<Record<string, number | null>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [extraDiscountPercent, setExtraDiscountPercent] = useState(0);
  const [extraDiscountAmount, setExtraDiscountAmount] = useState(0);
  const [revisionFee, setRevisionFee] = useState(0);
  const [exportOrientation, setExportOrientation] = useState<'portrait' | 'landscape'>('portrait');


  const selectedServices = useMemo(() => ALL_SERVICES.filter((s) => selectedIds.has(s.id)), [selectedIds]);

  const toggleService = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const updateM2 = useCallback((id: string, val: number) => {
    setServiceM2s((prev) => ({ ...prev, [id]: val }));
  }, []);

  // Per-service effective price: special price override or formula price
  const effectivePrices = useMemo(() => {
    const map: Record<string, { total: number; member: number; unit: number; isSpecial: boolean } | null> = {};
    selectedServices.forEach((s) => {
      const m2 = getServiceM2(s, serviceM2s);
      if (m2 >= 5000) { map[s.id] = null; return; }
      const special = specialPrices[s.id];
      if (special != null) {
        map[s.id] = { total: special, member: Math.round(special * 0.8), unit: Math.round(special / m2), isSpecial: true };
      } else {
        const p = calcServicePrice(s.basePrice, m2);
        if (p) map[s.id] = { ...p, isSpecial: false };
        else map[s.id] = null;
      }
    });
    return map;
  }, [selectedServices, serviceM2s, specialPrices]);

  // Apply extra discount on top
  const totals = useMemo(() => {
    let standard = 0;
    let subscriber = 0;
    let hasCustom = false;
    selectedServices.forEach((s) => {
      const m2 = getServiceM2(s, serviceM2s);
      if (m2 >= 5000) { hasCustom = true; return; }
      const ep = effectivePrices[s.id];
      if (ep) {
        standard += ep.total;
        subscriber += ep.member;
      }
    });
    // Extra discount (applied to subscriber total)
    const extra = extraDiscountPercent > 0
      ? Math.round(subscriber * extraDiscountPercent / 100)
      : extraDiscountAmount;
    return {
      standard,
      subscriber: subscriber - extra,
      saving: standard - subscriber + extra,
      extraDiscount: extra,
      hasCustom,
      count: selectedServices.length,
    };
  }, [selectedServices, serviceM2s, effectivePrices, extraDiscountPercent, extraDiscountAmount]);

  // Collect each service's data for preview
  const serviceData = useMemo(() =>
    selectedServices.map((s) => ({
      service: s,
      m2: getServiceM2(s, serviceM2s),
      effectivePrice: effectivePrices[s.id] ?? null,
    })),
    [selectedServices, serviceM2s, effectivePrices],
  );

  const handlePrint = useCallback(() => { window.print(); }, []);
  const handleGenerate = useCallback(() => {
    if (selectedServices.length === 0) return;
    setMode('preview');
  }, [selectedServices]);

  /* ─── BUILDER MODE ─── */

  if (mode === 'builder') {
    return (
      <div className="min-h-0 bg-background text-white">
        <style>{ANIM_STYLES}</style>

        <div className="pointer-events-none fixed inset-0">
          <div className="absolute top-1/4 left-1/3 h-96 w-96 rounded-full bg-primary/[0.08] blur-[140px]" />
          <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-amber-400/[0.06] blur-[120px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1600px] px-3 md:px-4 py-8 md:py-10">
          {/* Top Bar */}
          <div className="mb-8 flex items-center justify-between">
            <a href="/dashboard" className="group flex items-center gap-2.5 text-[10px] uppercase tracking-[0.3em] text-gray-500 hover:text-primary transition-all duration-300">
              <span className="flex h-7 w-7 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] group-hover:border-primary/30 group-hover:bg-primary/10 transition-all duration-300">
                <ArrowLeft className="h-3 w-3" />
              </span>
              Dashboard
            </a>
            <div className="flex items-center gap-3">
              <span className="font-serif text-xl italic text-white tracking-wider">Archilya</span>
              <span className="text-[8px] uppercase tracking-[0.32em] text-primary font-semibold">Sunum</span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8 text-center anim-fade-in-up">
            <p className="mb-4 text-xs uppercase tracking-[0.34em] text-primary font-semibold">Archilya Hizmet Bedeli Sunumu</p>
            <h1 className="mb-5 text-4xl italic leading-tight text-white md:text-5xl lg:text-6xl drop-shadow-[0_0_20px_rgba(255,255,255,0.06)]">
              Tek Tıkla Teklif Hazırla
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-gray-400/90">
              Hizmetleri seç, her biri için ayrı alan belirle ve butona bas. Archilya dinamik fiyatlandırma
              yapısına göre hesaplanmış profesyonel bir sunum anında hazır.
            </p>
          </div>

          {/* Quick tip */}
          <div className="mb-8 rounded-sm border border-primary/20 bg-gradient-to-r from-primary/[0.06] to-transparent px-5 py-4 flex items-center gap-3 backdrop-blur-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 border border-primary/20 shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </span>
            <p className="text-[11px] text-gray-400/90 leading-relaxed font-medium">
              Her hizmetin alanını ayrı ayrı girebilirsiniz. Varsayılan değerler hizmet türüne göre önceden ayarlanmıştır.
            </p>
          </div>

          {/* Service Selection */}
          <div className="space-y-8">
            <div>
              <Divider label="Mimari Hizmetler" color="primary" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {ARCH_SERVICES.map((s) => (
                  <ServiceSelectCard
                    key={s.id}
                    service={s}
                    m2={getServiceM2(s, serviceM2s)}
                    selected={selectedIds.has(s.id)}
                    onToggle={() => toggleService(s.id)}
                    onM2Change={(val) => updateM2(s.id, val)}
                    specialPrice={specialPrices[s.id] ?? null}
                    onSpecialPriceChange={(val) => setSpecialPrices((prev) => ({ ...prev, [s.id]: val }))}
                  />
                ))}
              </div>
            </div>

            <div>
              <Divider label="VR & Dijital Sunum" color="amber" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {VR_SERVICES.map((s) => (
                  <ServiceSelectCard
                    key={s.id}
                    service={s}
                    m2={getServiceM2(s, serviceM2s)}
                    selected={selectedIds.has(s.id)}
                    onToggle={() => toggleService(s.id)}
                    onM2Change={(val) => updateM2(s.id, val)}
                    specialPrice={specialPrices[s.id] ?? null}
                    onSpecialPriceChange={(val) => setSpecialPrices((prev) => ({ ...prev, [s.id]: val }))}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Advanced Options (Extra Discount + Revision Fee) */}
          {selectedServices.length > 0 && (
            <div className="mt-8 rounded-sm border border-white/[0.06] bg-white/[0.015] p-5 md:p-6 backdrop-blur-2xl">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-gray-500 hover:text-primary transition-all duration-300 group cursor-pointer"
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] transition-all duration-300 ${showAdvanced ? 'rotate-90 border-primary/30 bg-primary/10' : ''} group-hover:border-white/20`}>
                  <span className="text-[8px]">▶</span>
                </span>
                <span className="font-bold">Ek İndirim & Revizyon Ayarları</span>
              </button>

              {showAdvanced && (
                <div className="mt-5 pt-5 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Extra discount percent */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 font-bold">Ek % İndirim</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={extraDiscountPercent}
                        min={0}
                        max={100}
                        onChange={(e) => { setExtraDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0))); setExtraDiscountAmount(0); }}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-sm px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 focus:bg-primary/[0.04] transition-all duration-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-gray-500 font-bold">%</span>
                    </div>
                  </div>

                  {/* Extra discount amount */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 font-bold">Ek TL İndirim</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={extraDiscountAmount}
                        min={0}
                        step={100}
                        onChange={(e) => { setExtraDiscountAmount(Math.max(0, parseInt(e.target.value) || 0)); setExtraDiscountPercent(0); }}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-sm px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 focus:bg-primary/[0.04] transition-all duration-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-gray-500 font-bold">TL</span>
                    </div>
                    <p className="text-[9px] text-gray-600 font-medium">Abone toplamından düşülür</p>
                  </div>

                  {/* Revision fee */}
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 font-bold">Revizyon Ücreti</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={revisionFee}
                        min={0}
                        step={50}
                        onChange={(e) => setRevisionFee(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full bg-white/[0.04] border border-white/10 rounded-sm px-3 py-2 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 focus:bg-primary/[0.04] transition-all duration-200 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <span className="text-xs text-gray-500 font-bold">TL/revizyon</span>
                    </div>
                    <p className="text-[9px] text-gray-600 font-medium">Ek revizyon ücreti revizyon başına belirtilen tutar olarak eklenir</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom Bar */}
          <div className="sticky bottom-4 mt-6 rounded-sm border border-white/[0.06] bg-surface/80 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] p-5 md:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-gray-500 font-bold">Seçilen:</span>
                  <span className="text-base font-bold text-white">{totals.count} hizmet</span>
                </div>
                {totals.count > 0 && !totals.hasCustom && (
                  <>
                    <div className="hidden sm:block h-8 w-px bg-white/[0.06]" />
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-[0.22em] text-gray-500 font-bold">Standart</p>
                        <p className="text-base font-serif text-white">{fmt(totals.standard)} TL</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] uppercase tracking-[0.22em] text-primary font-bold">Abone</p>
                        <p className="text-base font-serif text-primary">{fmt(totals.subscriber)} TL</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={selectedServices.length === 0}
                className={`flex items-center gap-2.5 px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.25em] rounded-sm transition-all duration-500 ${
                  selectedServices.length > 0
                    ? 'bg-primary text-black hover:bg-white shadow-[0_0_25px_rgba(198,168,124,0.35)] hover:shadow-[0_0_40px_rgba(198,168,124,0.5)] cursor-pointer'
                    : 'bg-white/[0.04] text-gray-500 border border-white/10 cursor-not-allowed'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                Sunumu Oluştur
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ─── PREVIEW MODE ─── */

  const isCustom = serviceData.some((d) => d.m2 >= 5000);

  return (
    <div className="min-h-0 bg-background text-white overflow-x-hidden">
      <style>{ANIM_STYLES}</style>

      {/* Floating controls */}
      <div className="fixed top-16 right-4 z-50 flex items-center gap-2 print:hidden">
        <button
          onClick={() => setMode('builder')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-sm border border-white/10 bg-surface/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.25em] text-gray-300 hover:text-white hover:border-white/20 transition-all cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Düzenle
        </button>

        {/* Orientation toggle */}
        <div className="flex rounded-sm border border-white/10 overflow-hidden">
          <button
            onClick={() => setExportOrientation('portrait')}
            className={`px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              exportOrientation === 'portrait' ? 'bg-primary text-black' : 'bg-surface/80 text-gray-400 hover:text-white'
            }`}
          >
            Dikey
          </button>
          <button
            onClick={() => setExportOrientation('landscape')}
            className={`px-3 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              exportOrientation === 'landscape' ? 'bg-primary text-black' : 'bg-surface/80 text-gray-400 hover:text-white'
            }`}
          >
            Yatay
          </button>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2.5 rounded-sm border border-primary/30 bg-primary/10 backdrop-blur-md text-[10px] font-bold uppercase tracking-[0.25em] text-primary hover:bg-primary/20 transition-all cursor-pointer"
          title="PDF/PNG olarak kaydet (tarayıcı yazdırma)"
        >
          <Printer className="h-3.5 w-3.5" />
          PDF / PNG
        </button>
      </div>

      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/[0.08] to-transparent" />
        <div className="absolute left-[-8rem] top-20 h-80 w-80 rounded-full bg-primary/[0.08] blur-[160px]" />
        <div className="absolute bottom-0 right-[-6rem] h-96 w-96 rounded-full bg-amber-400/[0.08] blur-[180px]" />
        <div className="noise-overlay" />
      </div>
      <div className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.3) 0.7px, transparent 0.7px)',
          backgroundSize: '14px 14px',
        }}
      />

      <main className="relative z-10">
        <section className="mx-auto max-w-[1600px] px-3 md:px-4 py-8 md:py-10">
          {/* Header */}
          <div className="mb-6 text-center anim-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 mb-4">
              <Sparkles className="h-2.5 w-2.5 text-primary" />
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-primary">Archilya Hizmet Bedeli Sunumu</span>
            </div>
            <h1 className="mb-4 text-2xl italic leading-tight text-white md:text-3xl drop-shadow-[0_0_15px_rgba(255,255,255,0.06)]">
              {serviceData.map((d) => d.service.name).join(' + ')}
            </h1>
            <p className="mx-auto max-w-3xl text-xs leading-relaxed text-gray-400/90">
              Bu sayfa, Archilya dinamik fiyatlandırma yapısına göre {serviceData.length} hizmet için hazırlanmıştır.
              Hesaplama formülü <strong className="text-gray-100">Fiyat = Taban Fiyat × (m² / 100)^0.8</strong> olup
              sonuçlar en yakın tam sayıya yuvarlanmıştır.
              Abone indirimi tüm standart fiyatlar üzerinden <strong className="text-primary">%20</strong> olarak uygulanır.
            </p>
          </div>

          {/* Summary Stats (only if no custom m2) */}
          {!isCustom && (
            <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-4 anim-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <StatCard label="Standart Toplam" value={`${fmt(totals.standard)} TL`} />
              <StatCard label="Abone Toplamı" value={`${fmt(totals.subscriber)} TL`} accent="primary" />
              <StatCard label="Abone İndirimi" value="%20" sub={`${fmt(totals.saving)} TL tasarruf${totals.extraDiscount > 0 ? ` + ${fmt(totals.extraDiscount)} TL ek` : ''}`} accent="emerald" />
              <StatCard label="Toplam Alan" value={`${fmt(serviceData.reduce((s, d) => s + d.m2, 0))} m²`} sub={`${totals.count} hizmet · ${serviceData.map(d => `${fmt(d.m2)}m²`).join(' + ')}`} />
            </div>
          )}

          {/* Service Cards + Combined Total */}
          <div className={serviceData.length >= 3 ? 'flex gap-4 flex-wrap [&>*]:w-[300px] md:[&>*]:w-[335px]' : 'grid grid-cols-1 lg:grid-cols-3 gap-5'}>
            {serviceData.map((d, i) => (
              <ServicePreviewCard
                key={d.service.id}
                service={d.service}
                m2={d.m2}
                index={i}
                specialPrice={d.effectivePrice?.isSpecial ? d.effectivePrice.total : null}
              />
            ))}

            {/* Combined Total Card */}
            {!isCustom && serviceData.length > 1 && (
              <div
                className="anim-fade-in-up panel-sheen rounded-sm border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-surface/75 to-surface/90 p-5 shadow-[0_28px_80px_rgba(198,168,124,0.12)] backdrop-blur-2xl"
                style={{ animationDelay: `${serviceData.length * 0.06}s` }}
              >
                <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-black shadow-[0_0_20px_rgba(198,168,124,0.3)]">
                  <Crown className="h-3.5 w-3.5" />
                  Toplam Teklif Özeti
                </div>

                <h2 className="mb-1 text-2xl italic text-white">Birleşik Toplam</h2>
                <p className="mb-4 text-xs leading-relaxed text-gray-300">{serviceData.length} hizmet için toplam yatırım bedeli.</p>

                <div className="mb-3 rounded-sm border border-white/[0.06] bg-black/30 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-gray-500 font-semibold">Standart Toplam</p>
                  <p className="mt-1 text-3xl font-serif text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">{fmt(totals.standard)} TL</p>
                </div>

                <div className="mb-4 rounded-sm border border-primary/25 bg-gradient-to-r from-primary/[0.12] to-transparent px-4 py-3 shadow-[0_0_20px_rgba(198,168,124,0.08)]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Abone Toplamı</p>
                  <p className="mt-1 text-2xl font-serif text-primary drop-shadow-[0_0_12px_rgba(198,168,124,0.2)]">{fmt(totals.subscriber)} TL</p>
                  {totals.extraDiscount > 0 && <p className="text-[9px] text-amber-400 mt-0.5">Ek indirim: -{fmt(totals.extraDiscount)} TL</p>}
                </div>

                {/* Distribution */}
                {(() => {
                  const allPrices = serviceData.map((d) => calcServicePrice(d.service.basePrice, d.m2));
                  const totalStandard = allPrices.reduce((sum, p) => sum + (p?.total ?? 0), 0);
                  return (
                    <div className="mb-3">
                      <p className="mb-1 text-[9px] uppercase tracking-[0.24em] text-gray-500">Dağılım</p>
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-black/30">
                        {serviceData.map((d, i) => {
                          const p = allPrices[i];
                          const pct = p && totalStandard > 0 ? (p.total / totalStandard) * 100 : 0;
                          return <div key={d.service.id} className={DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length]} style={{ width: `${pct}%` }} title={`${d.service.name}: %${Math.round(pct)}`} />;
                        })}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-gray-400">
                        {serviceData.map((d, i) => {
                          const p = allPrices[i];
                          const pct = p && totalStandard > 0 ? Math.round((p.total / totalStandard) * 100) : 0;
                          const colorCls = DISTRIBUTION_COLORS[i % DISTRIBUTION_COLORS.length].replace('bg-', 'text-');
                          return <span key={d.service.id}><span className={colorCls}>{d.service.name}: %{pct}</span></span>;
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="rounded-sm border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-[10px] leading-relaxed text-gray-400 backdrop-blur-sm">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">Formül referansı:</span><br />
                  <strong className="text-gray-100">Fiyat = Taban Fiyat × (m² / 100)^0.8</strong>.<br />
                  Abone fiyatları, her hizmetin standart tutarına <strong className="text-primary">%20 indirim</strong> uygulanarak hesaplanmıştır.
                  {totals.extraDiscount > 0 && <> · Ek indirim: <strong className="text-amber-400">-{fmt(totals.extraDiscount)} TL</strong></>}
                  {revisionFee > 0 && <> · Ek revizyon ücreti revizyon başına <strong className="text-amber-400">{fmt(revisionFee)} TL</strong> olarak eklenir</>}
                </div>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="anim-fade-in mt-6 rounded-sm border border-white/10 bg-surface/55 p-4 text-xs leading-relaxed text-gray-400 backdrop-blur-sm" style={{ animationDelay: '0.4s' }}>
            <p className="mb-1 text-[9px] uppercase tracking-[0.28em] text-primary font-bold">Hesap Notu</p>
            <p>
              {serviceData.map((d, i) => (
                <span key={d.service.id}>
                  {i > 0 && ' · '}
                  <strong className="text-gray-100">{d.service.name}</strong> — {fmt(d.m2)} m², taban fiyat <strong className="text-gray-100">{fmt(d.service.basePrice)} TL</strong>
                </span>
              ))}
              . Tüm hizmetlerde sonuçlar <strong className="text-gray-100">Math.round</strong> mantığıyla en yakın tam sayıya yuvarlanmış,
              ardından abone kullanıcılar için standart tutar üzerinden <strong className="text-primary">%20 indirim</strong> uygulanmıştır.
              {totals.extraDiscount > 0 && <> · <strong className="text-amber-400">Ek indirim: -{fmt(totals.extraDiscount)} TL</strong></>}
              {revisionFee > 0 && <> · Ek revizyon ücreti revizyon başına <strong className="text-amber-400">{fmt(revisionFee)} TL</strong> olarak eklenir</>}
            </p>
          </div>
        </section>
      </main>

      <style>{`
        @media print {
          @page { margin: 1cm; size: A4 ${exportOrientation}; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { background: #0f1115 !important; min-height: 100%; }
          body > div { background: #0f1115; }
          .fixed { display: none !important; }
          .pointer-events-none { display: none !important; }
          [class*="blur-"] { display: none !important; }
          [class*="backdrop-blur"] { -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
          [class*="shadow-"] { box-shadow: none !important; }
          .anim-fade-in-up, .anim-fade-in { opacity: 1 !important; animation: none !important; transform: none !important; }
          section { padding-top: 0.5rem !important; }
          .grid { break-inside: avoid; }
          h1, h2, h3, h4 { break-after: avoid; }
          img, svg { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
