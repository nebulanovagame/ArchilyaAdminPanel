import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, BarChart3, Sun, GitBranch, MonitorPlay, Check,
} from 'lucide-react';
import clsx from 'clsx';

const VR_FEATURES = [
  {
    id: 'living',
    icon: Palette,
    title: 'Yaşayan Mekan',
    subtitle: 'Canlı Tasarım & Mekanik Etkileşimler',
    tag: 'Archilya VR',
    desc: 'Geleneksel, hareketsiz renderların ötesine geçin. Kapıları açın, mobilya kapaklarını deneyin, duvar ve zemin materyallerini Tasarım Modu ile saniyeler içinde değiştirerek anlık kararlar alın.',
    details: [
      'Kapı, Işık ve Mobilya Mekanik Etkileşimleri',
      'Tasarım Modu: Anlık Materyal & Zemin Değişimi',
      'Nesne Bazlı Bilgi Ekranları (Object Info)',
      'Toplu Tasarım Şemaları (Design Schemes)',
    ],
    media: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&q=80&auto=format&fit=crop',
    mediaAlt: 'Yaşayan Mekan — Canlı Tasarım Demo',
    mediaType: 'image',
  },
  {
    id: 'budget',
    icon: BarChart3,
    title: 'Eşzamanlı ve İnteraktif Bütçe Yönetimi',
    subtitle: 'Canlı Maliyet Takibi & Raporlama',
    tag: 'Archilya VR Pro',
    desc: 'Her malzeme, mobilya veya tasarım değişikliği maliyet barına eşzamanlı yansır. Sunum sonunda tek tıkla HTML, CSV veya JSON formatında net maliyet raporu oluşturun.',
    details: [
      'Seçimlere Göre Eşzamanlı Maliyet Barı',
      'Bütçe Sınırı Uyarı Sistemi',
      'HTML, CSV, JSON Formatında Maliyet Raporu',
      'Malzeme Karşılaştırma ve Varyasyon Tablosu',
    ],
    media: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=900&q=80&auto=format&fit=crop',
    mediaAlt: 'Eşzamanlı Bütçe Yönetimi Demo',
    mediaType: 'image',
  },
  {
    id: 'scenarios',
    icon: Sun,
    title: 'Dinamik Senaryolar & Mevsim Döngüsü',
    subtitle: 'Zaman & Aydınlatma Şovu',
    tag: 'Archilya VR Pro',
    desc: 'Sabah güneşini, akşam loşluğunu veya gece aydınlatma senaryolarını müşterinize canlı yaşatın. Farklı aydınlatma ve yerleşim senaryoları arasında anında geçiş yaparak unutulmaz bir şov yaratın.',
    details: [
      'Gerçek Zamanlı Gün Işığı, Saat & Güneş Döngüsü',
      'Mevsim Senaryoları (Yaz / Kış / Sisli / Gece)',
      'Aydınlatma & Yerleşim Senaryoları Arası Geçiş',
      'Sinematik Kamera ile Yüksek Çözünürlüklü Çıktı',
    ],
    media: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&q=80&auto=format&fit=crop',
    mediaAlt: 'Dinamik Senaryolar & Mevsim Döngüsü Demo',
    mediaType: 'image',
  },
];

const PANEL_FEATURES = [
  {
    id: 'sync',
    icon: GitBranch,
    title: 'Dosya Senkronizasyonu & Sürüm Kontrolü',
    subtitle: 'Revizyon Yönetimi',
    tag: 'Archilya Panel',
    desc: '"Versiyon_Son_Final_v3" kabusuna son. Tüm revizyon geçmişiniz şifrelenmiş bulut sunucularında saklanır. İstediğiniz an önceki bir tasarıma dönebilir, ekibinizle anlık senkronize çalışabilirsiniz.',
    details: [
      'Bulut Tabanlı Sürüm Geçmişi & Anlık Senkronizasyon',
      '5 Kayıt Yuvası + Varsayılan Profil (Save Slots)',
      'Ekip İçi Revizyon Takibi ve Geri Dönüş',
      'Güvenli & Şifrelenmiş Bulut Depolama',
    ],
    media: 'https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=900&q=80&auto=format&fit=crop',
    mediaAlt: 'Dosya Senkronizasyonu & Sürüm Kontrolü Demo',
    mediaType: 'image',
  },
  {
    id: 'platform',
    icon: MonitorPlay,
    title: 'Çoklu Platform & Sunum Esnekliği',
    subtitle: 'Her Cihazdan Erişim',
    tag: 'Archilya Panel',
    desc: 'Archilya; klavye, fare, gamepad, dokunmatik ekran ve VR başlıklarıyla tam uyumludur. Projelerinizi yüksek performansla sunarken farklı cihaz ve ortamlara kolayca uyarlanabilirsiniz.',
    details: [
      'Klavye / Mouse / Gamepad / Dokunmatik Kontrol',
      'Çoklu Platform Desteği (Windows & Uyumlu Cihazlar)',
      'Bulut Altyapısıyla Veri & Kullanıcı Yönetimi',
      'Çoklu Ünite (Multi-Unit) Proje Desteği',
    ],
    media: 'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=900&q=80&auto=format&fit=crop',
    mediaAlt: 'Çoklu Platform Desteği Demo',
    mediaType: 'image',
  },
];

function MediaBlock({ feature, accent }) {
  const borderCls = accent === 'amber' ? 'border-amber-400/20 hover:border-amber-400/40' : 'border-primary/20 hover:border-primary/40';
  const cornerCls = accent === 'amber' ? 'border-amber-400/40' : 'border-primary/40';
  const tagCls = accent === 'amber' ? 'bg-amber-400/15 text-amber-400 border-amber-400/25' : 'bg-primary/15 text-primary border-primary/25';

  return (
    <div className={clsx('relative w-full aspect-video rounded-sm border overflow-hidden transition-all duration-500 group', borderCls)}>
      <img
        src={feature.media}
        alt={feature.mediaAlt}
        className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-[1.02] transition-all duration-700"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className={`absolute inset-0 bg-gradient-to-br ${accent === 'amber' ? 'from-amber-400/5' : 'from-primary/5'} to-transparent`} />

      <div className={`absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 ${cornerCls}`} />
      <div className={`absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 ${cornerCls}`} />
      <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 ${cornerCls}`} />
      <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 ${cornerCls}`} />

      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
        <span className={clsx('text-[9px] font-bold uppercase tracking-[0.25em] px-2.5 py-1 rounded-sm border backdrop-blur-sm', tagCls)}>
          {feature.tag}
        </span>
        <span className="text-[9px] text-white/30 uppercase tracking-widest font-sans">
          Demo / Placeholder
        </span>
      </div>
    </div>
  );
}

function FeatureBlock({ features, accent }) {
  const [active, setActive] = useState(0);
  const cur = features[active];

  const A = accent === 'amber' ? {
    activeBorder: 'border-amber-400/40',
    glow: 'shadow-[0_0_24px_rgba(251,191,36,0.10)]',
    iconActive: 'bg-amber-400 text-black',
    iconIdle: 'bg-white/5 text-gray-500 group-hover:text-white',
    tag: 'text-amber-400',
    glowGrad: 'from-amber-400/8',
    check: 'bg-amber-400/15 text-amber-400',
    detailBorder: 'border-amber-400/20',
    lineBottom: 'from-amber-400/30',
  } : {
    activeBorder: 'border-primary/40',
    glow: 'shadow-[0_0_24px_rgba(198,168,124,0.10)]',
    iconActive: 'bg-primary text-black',
    iconIdle: 'bg-white/5 text-gray-500 group-hover:text-white',
    tag: 'text-primary',
    glowGrad: 'from-primary/8',
    check: 'bg-primary/15 text-primary',
    detailBorder: 'border-primary/20',
    lineBottom: 'from-primary/30',
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <div className="lg:col-span-4 space-y-2">
        {features.map((f, i) => (
          <button
            key={f.id}
            onClick={() => setActive(i)}
            className={clsx(
              'w-full text-left p-5 rounded-sm border transition-all duration-300 group relative overflow-hidden',
              active === i
                ? `bg-surface ${A.activeBorder} ${A.glow}`
                : 'bg-transparent border-white/5 hover:bg-white/3 hover:border-white/12',
            )}
          >
            <div className="flex items-start gap-3 relative z-10">
              <div className={clsx('p-2.5 rounded-sm transition-colors shrink-0', active === i ? A.iconActive : A.iconIdle)}>
                <f.icon className="w-4 h-4" />
              </div>
              <div>
                <p className={clsx('text-[9px] font-bold uppercase tracking-widest mb-1 opacity-80', A.tag)}>{f.tag}</p>
                <h4 className={clsx('text-sm font-serif leading-snug transition-colors', active === i ? 'text-white' : 'text-gray-400 group-hover:text-gray-200')}>
                  {f.title}
                </h4>
              </div>
            </div>
            {active === i && (
              <motion.div layoutId={`glow-${accent}`} className={`absolute inset-0 bg-gradient-to-r ${A.glowGrad} to-transparent pointer-events-none`} />
            )}
          </button>
        ))}
      </div>

      <div className="lg:col-span-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={cur.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={clsx('rounded-sm border bg-surface/50 backdrop-blur-sm p-7 relative overflow-hidden', A.activeBorder)}
          >
            <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${A.lineBottom} to-transparent`} />

            <div className="mb-7">
              <MediaBlock feature={cur} accent={accent} />
            </div>

            <p className={clsx('text-[10px] font-bold uppercase tracking-[0.25em] mb-1', A.tag)}>{cur.subtitle}</p>
            <h3 className="text-xl font-serif text-white italic mb-3">{cur.title}</h3>
            <p className="text-gray-500 text-xs leading-relaxed mb-6 border-l-2 border-white/8 pl-4">{cur.desc}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {cur.details.map((d, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                  className="flex items-start gap-2.5 bg-black/20 border border-white/5 rounded-sm px-3.5 py-2.5"
                >
                  <div className={clsx('w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5', A.check)}>
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span className="text-xs text-gray-300 leading-relaxed">{d}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Features() {
  return (
    <section id="ozellikler" className="py-32 bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#c6a87c 1px, transparent 1px), linear-gradient(90deg, #c6a87c 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-amber-400/4 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-primary/4 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-20"
        >
          <p className="text-primary text-xs uppercase tracking-[0.3em] mb-4">Ekosistem</p>
          <h2 className="text-4xl md:text-5xl font-serif text-white italic mb-4">Özellikler</h2>
          <p className="text-gray-500 text-sm font-sans max-w-xl mx-auto leading-relaxed">
            Archilya, mimari ofislere iki farklı ama bütünleşik güç sunar.
            Sahnede yaşayan bir şov, arka planda ise kesintisiz bir yönetim sistemi.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true, margin: '-60px' }}>
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-3 px-5 py-2 border border-amber-400/20 rounded-sm bg-amber-400/5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-400">Archilya VR — Sunum Şovu</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-amber-400/20 to-transparent" />
          </div>

          <FeatureBlock features={VR_FEATURES} accent="amber" />
        </motion.div>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.5 }} viewport={{ once: true }} className="flex items-center gap-5 my-20">
          <div className="h-px flex-1 bg-white/5" />
          <span className="text-[9px] font-bold text-gray-700 uppercase tracking-[0.35em] px-4">Archilya Ekosistemi</span>
          <div className="h-px flex-1 bg-white/5" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} viewport={{ once: true, margin: '-60px' }}>
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-3 px-5 py-2 border border-primary/20 rounded-sm bg-primary/5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary">Archilya Panel — Bulut Yönetimi</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
          </div>

          <FeatureBlock features={PANEL_FEATURES} accent="primary" />
        </motion.div>
      </div>
    </section>
  );
}
