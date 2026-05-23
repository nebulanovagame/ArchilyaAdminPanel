/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  Check, Star, Zap, Crown, Glasses, Sparkles,
  Database, Cpu, LayoutGrid, Film, MonitorPlay,
  GitBranch, BadgeCheck, Headphones, Layers,
  ShieldHalf, Ruler, Rocket, Building2,
} from 'lucide-react';
import clsx from 'clsx';
import {
  ADD_ON_PACKAGES,
  calcPrice as sharedCalcPrice,
  PRICING_EXPLANATION,
  SHARED_M2_SLIDER,
  SUBSCRIPTION_PLANS,
  unitSavingPct as sharedUnitSavingPct,
  VR_PACKAGES,
} from '../data/pricingData';

const ARCH_PACKAGES = [
  {
    id: 1,
    name: 'Konsept Tasarım',
    description: 'Mimari ofis ile birlikte yürütülen, yoğun revizyonlu fikir geliştirme süreci.',
    basePrice: 18000,
    icon: LayoutGrid,
    guarantee: true,
    features: [
      'Kütle ve Yerleşim Planı',
      'Ortak Tasarım Süreci',
      '10 Revizyon Hakkı',
      'Konsept Diyagramlar',
    ],
  },
  {
    id: 2,
    name: 'İç Mekan Tasarımı',
    description: 'Yaşam alanlarını işlevsel, estetik ve markaya uygun biçimde kurgulayan mekan çözümleri.',
    basePrice: 18000,
    icon: Layers,
    features: [
      'Tefriş ve Yerleşim Planı',
      'Renk & Doku Analizi',
      'Sabit Mobilya Konsepti',
      'Aydınlatma Şeması',
    ],
  },
  {
    id: 3,
    name: 'Peyzaj ve Çevre Düzenleme',
    description: 'Projenin dış mekan, yeşil alan ve çevre tasarımını bütüncül bir bakışla planlayan hizmet.',
    basePrice: 8000,
    icon: GitBranch,
    features: [
      'Sert / Yumuşak Zemin Planı',
      'Bitkilendirme Şeması',
      'Çevre Aydınlatma Konsepti',
      'Açık Alan Kullanım Analizi',
    ],
  },
  {
    id: 4,
    name: 'Profesyonel Modelleme',
    description: 'Eskiz veya 2D projenin kaynak dosyasıyla birlikte teslim edilen yüksek kaliteli 3D modeli.',
    basePrice: 14000,
    icon: Cpu,
    features: [
      'Yüksek Detaylı (LOD) Model',
      'Tüm CAD / BIM Formatları',
      'Poligon veya Parametrik Altyapı',
      'Kaynak Dosya Teslimi',
    ],
  },
  {
    id: 5,
    name: 'Görselleştirme',
    description: 'Profesyonel aydınlatma ve materyal çalışmasıyla üretilen fotorealistik render seti.',
    basePrice: 15000,
    popular: true,
    icon: Film,
    features: [
      'Fotorealistik İç / Dış Mekan',
      'Işık ve Materyal Çalışması',
      '5–6 Kare 4K Çözünürlük',
      'Post-Prodüksiyon Rötuşu',
    ],
  },
  {
    id: 6,
    name: 'Ruhsat ve Uygulama',
    description: 'Belediye ve şantiye standartlarında hazırlanan fason 2D teknik çizim desteği.',
    basePrice: 10000,
    icon: BadgeCheck,
    features: [
      'Belediye Standartlarında Çizim',
      'Kat Planları ve Kesitler',
      'Mevzuat ve Yönetmelik Uyumu',
      'Sınırsız 2D Revizyon',
    ],
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: 'easeOut' } },
};

const SUBSCRIPTION_ICON_MAP = {
  sparkles: Sparkles,
  zap: Zap,
  rocket: Rocket,
  crown: Crown,
};

const VR_ICON_MAP = {
  glasses: Glasses,
  film: Film,
  monitor: MonitorPlay,
  layout: LayoutGrid,
  layers: Layers,
  crown: Crown,
  building: Building2,
  database: Database,
};

const VR_ARCHITECTURE_PACKAGES = VR_PACKAGES.slice(0, 6);
const VR_REAL_ESTATE_PACKAGES = VR_PACKAGES.slice(6);

const PRICING_FAMILY_CANVAS = 'rounded-sm';
const PRICING_META_SURFACE = 'rounded-sm border border-white/5 bg-white/[0.02] backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.4)]';
const PRICING_CARD_FRAME = 'relative rounded-sm border border-white/5 bg-white/[0.015] backdrop-blur-2xl transition-all duration-500 ease-out hover:-translate-y-2 hover:border-white/10 flex flex-col p-6 md:p-8';
const PRICING_CARD_ICON_FRAME = 'w-12 h-12 rounded-sm border flex items-center justify-center shrink-0 bg-white/[0.03] backdrop-blur-md';
const PRICING_SUPPORT_SURFACE = 'rounded-sm border border-white/5 bg-white/[0.02] backdrop-blur-lg';

function fmt(n) { return Math.round(n).toLocaleString('tr-TR'); }

export function calcPrice(basePrice, m2) {
  return sharedCalcPrice(basePrice, m2);
}

export function unitSavingPct(m2) {
  return sharedUnitSavingPct(m2);
}

function scrollToContact() {
  const el = document.getElementById('contact');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      const inp = el.querySelector('input[type="text"]');
      if (inp) inp.focus();
    }, 700);
  }
}

function SectionHeader({ tag, title, subtitle }) {
  return (
    <Motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65 }}
      viewport={{ once: true, margin: '-60px' }}
      className="text-center mb-12"
    >
      <p className="text-primary text-[10px] uppercase tracking-[0.3em] mb-3">{tag}</p>
      <h3 className="text-3xl md:text-4xl font-serif text-white italic mb-3">{title}</h3>
      {subtitle && <p className="text-gray-500 text-xs font-sans max-w-2xl mx-auto leading-relaxed">{subtitle}</p>}
    </Motion.div>
  );
}

function Divider({ icon, label, color = 'primary' }) {
  const DividerIcon = icon;
  const cls = color === 'amber'
    ? { line: 'via-amber-400/20 to-amber-400/35', border: 'border-amber-400/20', bg: 'bg-amber-400/5', text: 'text-amber-400' }
    : { line: 'via-primary/20 to-primary/35', border: 'border-primary/20', bg: 'bg-primary/5', text: 'text-primary' };

  return (
    <Motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
      className="relative flex items-center gap-5 my-16 md:my-18"
    >
      <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${cls.line}`} />
      <div className={`flex items-center gap-3 px-6 py-2.5 border ${cls.border} rounded-xl ${cls.bg} shrink-0 backdrop-blur-md`}>
        <DividerIcon className={`w-3.5 h-3.5 ${cls.text}`} />
        <span className={`text-[10px] font-bold uppercase tracking-[0.3em] ${cls.text}`}>{label}</span>
        <DividerIcon className={`w-3.5 h-3.5 ${cls.text}`} />
      </div>
      <div className={`h-px flex-1 bg-gradient-to-l from-transparent ${cls.line}`} />
    </Motion.div>
  );
}

function M2Slider({ m2, setM2, min = SHARED_M2_SLIDER.min, max = SHARED_M2_SLIDER.max, step = SHARED_M2_SLIDER.step, ticks = SHARED_M2_SLIDER.ticks }) {
  const saving = unitSavingPct(m2);
  const pct = ((m2 - min) / (max - min)) * 100;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55 }}
      viewport={{ once: true }}
      className="sticky top-[76px] md:top-[77px] z-40 max-w-7xl mx-auto mb-16 px-6 py-4 rounded-sm border-b border-l border-r border-white/10 border-t-0 bg-[#0d0f13]/85 backdrop-blur-3xl shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
    >
      <style>{`
        .pricing-m2-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 3px;
          background: transparent;
        }

        .pricing-m2-slider::-webkit-slider-runnable-track {
          height: 3px;
          border-radius: 9999px;
          background: transparent;
        }

        .pricing-m2-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #c6a87c;
          border: 2px solid rgba(15, 17, 21, 0.96);
          box-shadow: 0 0 0 4px rgba(198, 168, 124, 0.14);
          margin-top: -5.5px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .pricing-m2-slider:hover::-webkit-slider-thumb {
          transform: scale(1.05);
          box-shadow: 0 0 0 6px rgba(198, 168, 124, 0.18);
        }

        .pricing-m2-slider::-moz-range-track {
          height: 3px;
          border: none;
          border-radius: 9999px;
          background: transparent;
        }

        .pricing-m2-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #c6a87c;
          border: 2px solid rgba(15, 17, 21, 0.96);
          box-shadow: 0 0 0 4px rgba(198, 168, 124, 0.14);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .pricing-m2-slider:hover::-moz-range-thumb {
          transform: scale(1.05);
          box-shadow: 0 0 0 6px rgba(198, 168, 124, 0.18);
        }
      `}</style>

      <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-12">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-10 h-10 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_15px_rgba(198,168,124,0.15)]">
            <Ruler className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.3em] font-bold">Ortak Alan Kontrolü</p>
            <p className="text-xs text-gray-400 font-sans mt-0.5">Mimari ve VR tekliflerini şekillendir</p>
          </div>
        </div>

        <div className="flex-1 max-w-3xl">
          <div className="relative pt-2">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={m2}
              onChange={(e) => setM2(Number(e.target.value))}
              aria-label="Ortak Alan Slider"
              className="pricing-m2-slider w-full cursor-pointer"
              style={{ background: `linear-gradient(to right, #c6a87c ${pct}%, rgba(255,255,255,0.08) ${pct}%)` }}
            />
            <div className="mt-3 flex justify-between px-0.5">
              {ticks.map((v) => (
                <button
                  key={v}
                  onClick={() => setM2(v)}
                  className={clsx('text-[9px] font-bold uppercase tracking-[0.2em] transition-colors', m2 === v ? 'text-primary' : 'text-gray-600 hover:text-gray-400')}
                >
                  {v >= 1000 ? `${v / 1000}K` : v} m²
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-end gap-3 shrink-0">
          <div className="text-right leading-none">
            <span className="font-serif text-3xl lg:text-4xl text-white drop-shadow-md">{m2 >= 5000 ? '5000+' : fmt(m2)}</span>
            <span className="text-sm text-gray-500 ml-1.5 font-sans">m²</span>
          </div>
          {saving > 0 && <span className="text-[10px] font-bold uppercase border border-emerald-400/20 bg-emerald-400/10 text-emerald-400 tracking-[0.2em] px-2 py-1.5 rounded-sm backdrop-blur-md mb-1">-%{saving} Avantaj</span>}
        </div>
      </div>
    </Motion.div>
  );
}

function SubCard({ plan }) {
  const Icon = SUBSCRIPTION_ICON_MAP[plan.iconKey] || Sparkles;
  return (
    <Motion.div variants={cardVariants} className={clsx('relative p-8 rounded-sm border backdrop-blur-2xl transition-all duration-500 ease-out flex flex-col hover:-translate-y-2', plan.popular ? 'bg-primary/[0.03] border-primary/30 shadow-[0_0_40px_rgba(198,168,124,0.15)] hover:shadow-[0_10px_50px_rgba(198,168,124,0.25)] hover:border-primary/50' : 'bg-white/[0.02] border-white/5 hover:border-white/15')}>
      {plan.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-black text-[10px] font-bold uppercase px-4 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shadow-[0_0_20px_rgba(198,168,124,0.4)]"><Star className="w-3 h-3 fill-black" /> En Çok Tercih Edilen</div>}

      <div className={`inline-flex items-center gap-2 mb-4 ${plan.color}`}>
        <Icon className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest">{plan.name}</span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed min-h-[3rem] mb-4">{plan.description}</p>

      <div className="mb-2">
        {plan.price === 0 ? (
          <span className="text-4xl font-serif text-white">Ücretsiz</span>
        ) : (
          <>
            <span className="text-4xl font-serif text-white">₺{fmt(plan.price)}</span>
            <span className="text-gray-600 text-xs ml-2">/ ay</span>
            {plan.priceAnnual && <p className="text-[10px] text-emerald-400 font-sans mt-1">Yıllık kurumsal teklif: ₺{fmt(plan.priceAnnual)}/ay eşdeğeri · satış ekibi üzerinden</p>}
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md"><Sparkles className={`w-3.5 h-3.5 ${plan.color}`} /><span className={`text-[10px] font-bold uppercase tracking-widest ${plan.color}`}>{fmt(plan.credits)} İşlem / ay</span></div>
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md"><Database className={`w-3.5 h-3.5 ${plan.color}`} /><span className={`text-[10px] font-bold uppercase tracking-widest ${plan.color}`}>{plan.storage}</span></div>
        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-1.5 backdrop-blur-md"><LayoutGrid className={`w-3.5 h-3.5 ${plan.color}`} /><span className={`text-[10px] font-bold uppercase tracking-widest ${plan.color}`}>{plan.projects}</span></div>
      </div>

      {plan.price > 0 && <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2 mb-6 w-fit backdrop-blur-md"><Crown className="w-3.5 h-3.5 text-primary" /><p className="text-[10px] text-primary font-bold">{PRICING_EXPLANATION.annualNote}</p></div>}

      <ul className="space-y-2.5 mb-8 flex-1">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5"><Check className={`w-3.5 h-3.5 ${plan.color} shrink-0 mt-0.5`} /><span className="text-xs text-gray-300 leading-relaxed">{f}</span></li>
        ))}
      </ul>

      <button onClick={scrollToContact} className={clsx('w-full py-3.5 px-6 rounded-sm text-[11px] font-bold uppercase tracking-[0.25em] transition-all duration-500 border mt-auto hover:shadow-lg', plan.popular ? 'bg-primary text-black border-primary hover:bg-white hover:border-white shadow-[0_0_20px_rgba(198,168,124,0.3)]' : 'bg-white/[0.03] border-white/10 text-gray-300 hover:border-primary/40 hover:text-white hover:bg-primary/10')}>
        {plan.cta}
      </button>
    </Motion.div>
  );
}

function ArchCard({ pkg, m2 }) {
  const Icon = pkg.icon;
  const isCustom = m2 >= 5000;
  const total = isCustom ? null : calcPrice(pkg.basePrice, m2);
  const memberPrice = isCustom ? null : Math.round(total * 0.8);
  const unitPrice = isCustom ? null : Math.round(total / m2);

  return (
    <Motion.div variants={cardVariants} className={clsx(PRICING_CARD_FRAME, pkg.popular ? 'bg-primary/[0.03] border-primary/30 shadow-[0_0_40px_rgba(198,168,124,0.15)] hover:shadow-[0_10px_50px_rgba(198,168,124,0.25)] hover:border-primary/50' : 'hover:border-white/15')}>
      {pkg.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-black text-[10px] font-bold uppercase px-4 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shadow-[0_0_20px_rgba(198,168,124,0.4)]"><Star className="w-3.5 h-3.5 fill-black" /> Popüler</div>}

      {pkg.guarantee && <div className="absolute -top-3 right-5 flex items-center gap-1.5 rounded-sm border border-emerald-400/40 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 shadow-[0_0_15px_rgba(52,211,153,0.15)] z-10"><ShieldHalf className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><span className="text-[8px] uppercase tracking-widest text-emerald-400 font-bold whitespace-nowrap">Beğenilmezse %50 İade</span></div>}

      <div className="flex flex-col h-[130px] mb-6">
        <div className="mb-5 flex items-start gap-4">
          <div className={clsx(PRICING_CARD_ICON_FRAME, pkg.popular ? 'bg-primary/10 border-primary/20 shadow-[0_0_20px_rgba(198,168,124,0.15)] text-primary' : 'border-white/5 bg-white/[0.02] text-gray-400')}><Icon className="w-5 h-5" /></div>
          <div className="min-w-0 pt-0.5"><h3 className="text-lg font-serif text-white italic leading-snug">{pkg.name}</h3></div>
        </div>
        <p className="text-gray-500 text-xs leading-relaxed line-clamp-3">{pkg.description}</p>
      </div>

      <div className={clsx('mb-8 rounded-sm overflow-hidden border', pkg.popular ? 'border-primary/20 bg-black/40 shadow-[inset_0_0_20px_rgba(198,168,124,0.05)]' : 'border-white/5 bg-black/20 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]')}>
        <div className={clsx('p-5 flex items-center justify-between gap-4', pkg.popular ? 'border-b border-primary/10 bg-primary/[0.02]' : 'border-b border-white/5 bg-white/[0.02]')}>
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-bold mb-1">Hesaplanan Tutar</p>
            <p className="text-[10px] text-gray-600 font-sans tracking-widest">{isCustom ? 'ÖZEL İLETİŞİM' : `Alan: ${fmt(m2)} m²`}</p>
          </div>
          <div className="text-right"><span className={clsx('font-serif tracking-tight', isCustom ? 'text-2xl text-primary font-bold uppercase drop-shadow-md' : 'text-3xl lg:text-[2.2rem] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] leading-none')}>{isCustom ? 'Özel Takvim' : `₺${fmt(total)}`}</span></div>
        </div>

        {!isCustom && (
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[0.2em] text-gray-500">m² Birim Fiyatı</span><div className="flex items-center gap-2.5">{unitSavingPct(m2) > 0 && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-sm border border-emerald-400/20">-%{unitSavingPct(m2)}</span>}<span className="text-xs font-serif text-gray-400">₺{fmt(unitPrice)}</span></div></div>

            <div className="flex items-center justify-between p-3 rounded-sm border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
              <div className="flex items-center gap-2.5"><div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40 shrink-0 shadow-[0_0_10px_rgba(198,168,124,0.2)]"><Crown className="w-3 h-3 text-primary" /></div><p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold">VIP Abone</p></div>
              <div className="text-right flex items-baseline gap-2"><span className="text-[10px] text-primary/40 line-through">₺{fmt(total)}</span><span className="text-lg font-serif text-primary drop-shadow-[0_0_10px_rgba(198,168,124,0.3)]">₺{fmt(memberPrice)}</span></div>
            </div>
          </div>
        )}
      </div>

      <ul className="space-y-2.5 mb-7 flex-1">
        {pkg.features.map((f, i) => <li key={i} className="flex items-start gap-2.5"><Check className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" /><span className="text-xs text-gray-300 leading-relaxed">{f}</span></li>)}
      </ul>

      <div className={clsx(PRICING_SUPPORT_SURFACE, 'mb-8 flex items-start gap-4 px-5 py-4')}><GitBranch className="w-4 h-4 text-primary/70 shrink-0 mt-0.5" /><p className="text-[10px] text-gray-400 font-sans leading-relaxed tracking-wider uppercase font-bold">Archilya Panel üzerinden anlık dosya eşitleme ve proje yönetimi</p></div>

      <button onClick={scrollToContact} className={clsx('w-full py-3.5 px-6 rounded-sm text-[11px] font-bold uppercase tracking-[0.25em] transition-all duration-500 border mt-auto hover:shadow-lg', pkg.popular ? 'bg-primary text-black border-primary hover:bg-white hover:border-white shadow-[0_0_20px_rgba(198,168,124,0.3)]' : 'bg-white/[0.03] border-white/10 text-gray-300 hover:border-primary/40 hover:text-white hover:bg-primary/10')}>Teklif Al</button>
    </Motion.div>
  );
}

function VRCard({ pkg, m2 = 100 }) {
  const Icon = VR_ICON_MAP[pkg.iconKey] || Glasses;
  const isCustom = pkg.pricingMode === 'm2-dynamic' && m2 >= 5000;
  const dynamicTotal = isCustom ? null : (pkg.pricingMode === 'm2-dynamic' ? calcPrice(pkg.basePrice, m2) : null);
  const dynamicMemberPrice = dynamicTotal ? Math.round(dynamicTotal * 0.8) : null;
  const dynamicUnitPrice = dynamicTotal ? Math.round(dynamicTotal / m2) : null;

  return (
    <Motion.div variants={cardVariants} className={clsx(PRICING_CARD_FRAME, pkg.badge ? 'bg-amber-400/[0.03] border-amber-400/30 shadow-[0_0_40px_rgba(251,191,36,0.1)] hover:shadow-[0_10px_50px_rgba(251,191,36,0.2)] hover:border-amber-400/50' : 'hover:border-white/15')}>
      {pkg.badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[10px] font-bold uppercase px-4 py-1.5 rounded-full flex items-center gap-1.5 whitespace-nowrap shadow-[0_0_20px_rgba(251,191,36,0.4)]">{pkg.badge}</div>}

      <div className="flex flex-col h-[140px] mb-6">
        <div className="mb-4 flex items-start gap-4">
          <div className={clsx(PRICING_CARD_ICON_FRAME, pkg.badge ? 'bg-amber-400/10 border-amber-400/20 shadow-[0_0_20px_rgba(251,191,36,0.15)] text-amber-400' : 'border-white/5 bg-white/[0.02] text-gray-400')}><Icon className="w-5 h-5" /></div>
          <div className="min-w-0 pt-0.5"><h3 className="text-lg font-serif italic text-white leading-snug">{pkg.name}</h3><p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/85 mt-2">{pkg.tagline}</p></div>
        </div>
        <p className="text-gray-500 text-xs leading-relaxed line-clamp-3">{pkg.description}</p>
      </div>

      <div className={clsx('mb-8 rounded-sm overflow-hidden border', pkg.badge ? 'border-amber-400/20 bg-black/40 shadow-[inset_0_0_20px_rgba(251,191,36,0.05)]' : 'border-white/5 bg-black/20 shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]')}>
        {pkg.pricingMode === 'fixed' && pkg.prices?.map((row, idx) => <div key={row.label} className={clsx('flex items-center justify-between gap-3 p-5', idx !== pkg.prices.length - 1 && (pkg.badge ? 'border-b border-amber-400/10 bg-amber-400/[0.02]' : 'border-b border-white/5 bg-white/[0.02]'))}><span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">{row.label}</span><span className="text-2xl font-serif text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.2)]">{row.value}</span></div>)}
        {(pkg.pricingMode === 'tiered' || pkg.pricingMode === 'unit-scale') && pkg.tiers?.map((row, idx) => <div key={row.label} className={clsx('flex items-center justify-between gap-3 p-5', idx !== pkg.tiers.length - 1 && (pkg.badge ? 'border-b border-amber-400/10 bg-amber-400/[0.02]' : 'border-b border-white/5 bg-white/[0.02]'))}><div><span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">{row.label}</span>{row.meta && <p className="text-[9px] text-gray-600 mt-1 font-sans">{row.meta}</p>}</div><span className="text-xl font-serif text-amber-300 drop-shadow-md text-right">{row.value}</span></div>)}

        {pkg.pricingMode === 'm2-dynamic' && (
          <>
            <div className={clsx('p-5 flex items-center justify-between gap-4', pkg.badge ? 'border-b border-amber-400/10 bg-amber-400/[0.02]' : 'border-b border-white/5 bg-white/[0.02]')}>
              <div>
                <p className="text-[9px] uppercase tracking-[0.3em] text-gray-500 font-bold mb-1">Hesaplanan Tutar</p>
                <p className="text-[10px] text-gray-600 font-sans tracking-widest">{isCustom ? 'ÖZEL İLETİŞİM' : `Alan: ${fmt(m2)} m²`}</p>
              </div>
              <div className="text-right"><span className={clsx('font-serif tracking-tight', isCustom ? 'text-2xl text-amber-400 font-bold uppercase drop-shadow-md' : 'text-3xl lg:text-[2.2rem] text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)] leading-none')}>{isCustom ? 'Özel Takvim' : `₺${fmt(dynamicTotal)}`}</span></div>
            </div>

            {!isCustom && dynamicTotal !== null && (
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between"><span className="text-[9px] uppercase tracking-[0.2em] text-gray-500">m² Birim Fiyatı</span><div className="flex items-center gap-2.5">{unitSavingPct(m2) > 0 && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-sm border border-emerald-400/20">-%{unitSavingPct(m2)}</span>}<span className="text-xs font-serif text-gray-400">₺{fmt(dynamicUnitPrice)}</span></div></div>

                <div className="flex items-center justify-between p-3 rounded-sm border border-amber-400/20 bg-gradient-to-r from-amber-400/10 to-transparent">
                  <div className="flex items-center gap-2.5"><div className="w-5 h-5 rounded-full bg-amber-400/20 flex items-center justify-center border border-amber-400/40 shrink-0 shadow-[0_0_10px_rgba(251,191,36,0.2)]"><Building2 className="w-3 h-3 text-amber-400" /></div><p className="text-[10px] uppercase tracking-[0.25em] text-amber-400 font-bold">Ortak Alan Avantajı</p></div>
                  <div className="text-right flex items-baseline gap-2"><span className="text-[10px] text-amber-400/40 line-through">₺{fmt(dynamicTotal)}</span><span className="text-lg font-serif text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">₺{fmt(dynamicMemberPrice)}</span></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {pkg.formula && <div className={clsx(PRICING_SUPPORT_SURFACE, 'mb-4 flex items-start gap-3 px-4 py-3')}><GitBranch className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /><p className="text-[10px] uppercase font-bold tracking-widest text-gray-400">Formül: <span className="text-amber-400/80">{pkg.formula}</span></p></div>}
      {pkg.footerNote && <div className={clsx(PRICING_SUPPORT_SURFACE, 'mb-8 flex items-start gap-3 px-4 py-3')}><Crown className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /><p className="text-[10px] uppercase tracking-widest text-gray-400 leading-relaxed font-bold">{pkg.footerNote}</p></div>}
      {!pkg.footerNote && !pkg.formula && <div className="mb-6" />}

      <ul className="space-y-2.5 mb-7 flex-1">{pkg.features.map((f, i) => <li key={i} className="flex items-start gap-2.5"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" /><span className="text-xs leading-relaxed text-gray-300">{f}</span></li>)}</ul>
      <button onClick={scrollToContact} className={clsx('w-full py-3.5 px-6 rounded-sm text-[11px] font-bold uppercase tracking-[0.25em] transition-all duration-500 border mt-auto hover:shadow-lg', pkg.badge ? 'bg-amber-400 text-black border-amber-400 hover:bg-white hover:border-white shadow-[0_0_20px_rgba(251,191,36,0.3)]' : 'bg-white/[0.03] border-white/10 text-gray-300 hover:border-amber-400/40 hover:text-white hover:bg-amber-400/10')}>Teklif Al</button>
    </Motion.div>
  );
}

export default function PricingCalculator() {
  const [sharedM2, setSharedM2] = useState(SHARED_M2_SLIDER.ticks[1]);

  return (
    <section id="pricing" className="py-32 bg-background relative overflow-clip">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-primary/4 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-[400px] h-[400px] bg-amber-400/3 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <Motion.div initial={{ opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} viewport={{ once: true, margin: '-80px' }} className="text-center mb-20">
          <p className="text-primary text-xs uppercase tracking-[0.3em] mb-4">Yatırım Planı</p>
          <h2 className="text-4xl md:text-5xl font-serif text-white italic mb-4">Fiyatlandırma</h2>
          <p className="text-gray-400 text-xs font-sans tracking-wide opacity-50">TÜM FİYATLAR KDV HARİÇ TÜRKİYE CUMHURİYETİ TÜRK LİRASI CİNSİNDENDİR</p>
        </Motion.div>

        <SectionHeader tag="Archilya Bulut Paneli" title="Abonelik & Entegrasyon" subtitle="Keşif, Solo, Pro ve Studio katmanlarıyla bireysel üretimden ekip operasyonuna kadar net geçiş sunar. İşlem mantığı ve ek kotalar profesyonel kullanım senaryosuna göre yeniden kalibre edilmiştir." />

        <Motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {SUBSCRIPTION_PLANS.map((plan) => <SubCard key={plan.id} plan={plan} />)}
        </Motion.div>

        <Motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }} viewport={{ once: true }} className="mt-8 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={clsx(PRICING_SUPPORT_SURFACE, 'p-5')}><p className="text-[10px] uppercase tracking-[0.28em] text-primary mb-2">{PRICING_EXPLANATION.unitTitle}</p><p className="text-xs text-gray-400 leading-relaxed">{PRICING_EXPLANATION.unitDescription}</p></div>
          <div className={clsx(PRICING_SUPPORT_SURFACE, 'p-5')}><p className="text-[10px] uppercase tracking-[0.28em] text-amber-400 mb-2">Studio havuz mantığı</p><p className="text-xs text-gray-400 leading-relaxed">{PRICING_EXPLANATION.studioNote}</p></div>
        </Motion.div>

        <Motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} viewport={{ once: true }} className="mt-12 max-w-3xl mx-auto">
          <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest mb-6">Ek İşlem Paketleri (Premium Top-Up)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ADD_ON_PACKAGES.map((pkg) => (
              <div key={pkg.id} className={clsx('relative p-6 rounded-sm border transition-all duration-300 hover:translate-y-[-4px] cursor-pointer', pkg.popular ? 'bg-[linear-gradient(180deg,rgba(48,40,26,0.34),rgba(14,15,19,0.94))] border-primary/24' : 'bg-[linear-gradient(180deg,rgba(18,22,29,0.84),rgba(10,12,17,0.94))] border-slate-800/80 hover:border-slate-700/80')}>
                {pkg.popular && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-black text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full whitespace-nowrap">En İyi Değer</div>}
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2">{pkg.label}</p>
                <div className="flex items-baseline gap-1 mb-1"><Zap className="w-3.5 h-3.5 text-primary" /><span className="text-xl font-serif text-white">{fmt(pkg.credits)}</span><span className="text-gray-600 text-xs">işlem kotası</span></div>
                <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">{pkg.description}</p>
                <div className="space-y-1.5 mb-4"><p className="text-xs text-primary font-bold">Abone fiyatı: ₺{fmt(pkg.subscriberPrice)}</p><p className="text-[11px] text-gray-500">Standart fiyat: ₺{fmt(pkg.standardPrice)}</p></div>
                <button onClick={scrollToContact} className="w-full py-2 text-[10px] font-bold uppercase tracking-widest border border-slate-700/80 bg-slate-950/45 text-gray-400 hover:border-primary/35 hover:text-primary rounded-sm transition-all">Satın Al</button>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-gray-600 mt-4">{PRICING_EXPLANATION.addOnNote}</p>
        </Motion.div>

        <div className={clsx('px-4 py-8 md:px-6 md:py-10 lg:px-8', PRICING_FAMILY_CANVAS)}>
          <Divider icon={LayoutGrid} label="Klasik Mimari Çözüm Ortaklığı" color="primary" />

          <SectionHeader tag="Fason Çizim & Model Hizmetleri" title="Mimari Destek Paketleri" subtitle={<>Alan büyüdükçe m² başına fiyat düşer · <span className="text-primary font-bold">ortak alan slider&apos;ı</span> mimari destek, mimari VR ve emlak VR tekliflerini birlikte günceller</>} />

          <M2Slider m2={sharedM2} setM2={setSharedM2} />

          <Motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {ARCH_PACKAGES.map((pkg) => <ArchCard key={pkg.id} pkg={pkg} m2={sharedM2} />)}
          </Motion.div>

          <Motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} viewport={{ once: true }} className="mt-10 text-center">
            <button onClick={scrollToContact} className="group inline-flex items-center gap-3 px-8 py-4 bg-transparent border border-gray-600 text-gray-300 hover:text-white hover:border-primary rounded-sm transition-all duration-300"><span className="text-xs font-bold uppercase tracking-widest">Özel Bütçe İçin İletişime Geç</span><div className="w-2 h-2 rounded-full bg-primary group-hover:scale-150 transition-transform" /></button>
          </Motion.div>

          <div className="mt-20 pt-8 border-t border-white/5 w-full"></div>
          <Divider icon={Glasses} label="Archilya Uygulama Ekosistemi" color="amber" />

          <SectionHeader tag="Dijital Şov Ekosistemi" title="Archilya Uygulama Ekosistemi" subtitle="Archilya VR katmanı; mimarlık ve iç mekan sunumlarını tek bir premium aplikasyon akışında toplar. İlk 6 mimari teklif ile son 2 emlak bloğu aynı ortak proje alanına bağlanır; farkı yaratan unsur teslim kapsamı ve ticari kullanım senaryosudur." />

          <Motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} viewport={{ once: true }} className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1.45fr_0.95fr] gap-4 mb-8">
            <div className={clsx('p-5 md:p-6', PRICING_META_SURFACE)}>
              <div className="flex items-center gap-3 mb-4"><div className="w-9 h-9 rounded-sm border border-amber-400/18 bg-amber-400/[0.08] flex items-center justify-center shrink-0"><Glasses className="w-4 h-4 text-amber-400" /></div><div><p className="text-[10px] text-amber-400 font-bold uppercase tracking-[0.3em]">Archilya XR Teklif Katmanı</p><p className="text-[11px] text-gray-500 mt-1">6 mimari / iç mekan paket + 2 emlak teslim bloğu</p></div></div>
              <p className="text-sm text-gray-300 leading-relaxed">Bu alan düz bir paket listesi değil; Archilya&apos;nın model aktarma, modelleme ve etkileşimli sunum akışını kapsayan uygulama ekosistemidir. Böylece mimari proje üretimi ile emlak sunum operasyonu aynı premium dilde, aynı ortak m² mantığıyla okunur; ayrım yalnızca teslim yoğunluğu ve kullanım bağlamında oluşur.</p>
            </div>

            <div className={clsx('p-5 md:p-6', PRICING_META_SURFACE)}>
              <div className="flex items-center gap-3 mb-4"><div className="w-9 h-9 rounded-sm border border-primary/18 bg-primary/[0.08] flex items-center justify-center shrink-0"><Ruler className="w-4 h-4 text-primary" /></div><div><p className="text-[10px] text-primary font-bold uppercase tracking-[0.3em]">Fiyat Okuma Mantığı</p><p className="text-[11px] text-gray-500 mt-1">Tüm teklifler aynı ortak proje alanına bağlanır</p></div></div>
              <p className="text-xs text-gray-400 leading-relaxed">Mimari destekten emlak VR&apos;a kadar tüm ticari teklifler <span className="text-white">aynı ortak proje alanı</span> üzerinden hesaplanır. Her kartta 100 m² taban fiyatı korunur, kapsam farkı ise kart içeriği ve teslim katmanında okunur.</p>
            </div>
          </Motion.div>

          <Motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} viewport={{ once: true, margin: '-40px' }} className={clsx('max-w-7xl mx-auto mb-8 p-5 md:p-6 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5', PRICING_META_SURFACE)}>
            <div>
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-[0.3em] mb-3">Mimarlık & İç Mekan VR Uygulamaları</p>
              <h4 className="text-2xl md:text-3xl font-serif text-white italic mb-3">Sunumdan etkileşimli şova uzanan 6 katman</h4>
              <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">Aktarma, materyal kaplama, sıfırdan modelleme ve interaktif karar senaryoları; mimari proje anlatısını aynı Archilya uygulama ekosistemi içinde büyüten ana teklif yapısıdır. Bu 6 katman da ortak proje alanına göre ölçeklenir.</p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-sm border border-slate-700/70 bg-slate-950/45 px-4 py-2 self-start lg:self-auto"><Glasses className="w-3.5 h-3.5 text-primary" /><span className="text-[10px] text-primary font-bold uppercase tracking-widest">İlk 6 teklif · ortak alan {fmt(sharedM2)} m² · aboneye %20 indirim</span></div>
          </Motion.div>

          <Motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {VR_ARCHITECTURE_PACKAGES.map((pkg) => <VRCard key={pkg.id} pkg={pkg} m2={sharedM2} />)}
          </Motion.div>

          <Motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} viewport={{ once: true, margin: '-40px' }} className={clsx('max-w-7xl mx-auto mt-12 mb-8 p-5 md:p-6', PRICING_META_SURFACE)}>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
              <div>
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-[0.3em] mb-3">Emlak & Çoklu Daire VR Sunumları</p>
                <h4 className="text-2xl md:text-3xl font-serif text-white italic mb-3">Ortak alan slider&apos;ına bağlanan satış ofisi bloğu</h4>
                <p className="text-xs text-gray-500 leading-relaxed max-w-2xl">Bu iki teklif daire stoğu ve proje lansman operasyonundan beslenir; ancak fiyatlama mantığı ilk 6 katmandan kopmaz. Ortak proje alanı aynı kalır, yalnızca teslim biçimi büyük blok ve çoklu daire operasyonuna uyarlanır.</p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-sm border border-slate-700/70 bg-slate-950/45 px-4 py-2 self-start lg:self-auto"><Building2 className="w-3.5 h-3.5 text-amber-400" /><span className="text-[10px] text-amber-300 font-bold uppercase tracking-widest">Son 2 teklif · ortak alan {fmt(sharedM2)} m² · toplu proje mantığı</span></div>
            </div>
          </Motion.div>

          <Motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-7xl mx-auto">
            {VR_REAL_ESTATE_PACKAGES.map((pkg) => <VRCard key={pkg.id} pkg={pkg} m2={sharedM2} />)}
          </Motion.div>

          <Motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }} viewport={{ once: true }} className={clsx('mt-10 max-w-7xl mx-auto flex items-start gap-3 p-5 md:p-6', PRICING_META_SURFACE)}>
            <Headphones className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500 leading-relaxed">Solo ve üzeri planlarda tüm VR tekliflerinde abone fiyatı uygulanır. İlk 6 mimari VR katmanı da son 2 emlak bloğu da aynı ortak proje alanına göre fiyatlanır; farkı belirleyen unsur kartların teslim kapsamı ve operasyon modelidir. Studio müşterilerinde tam gün kurulum, ekip eğitimi, white-label ve özel entegrasyon katmanları add-on veya kurumsal teklif olarak açılır.</p>
          </Motion.div>
        </div>
      </div>
    </section>
  );
}
