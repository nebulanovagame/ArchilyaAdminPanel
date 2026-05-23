import { motion } from 'framer-motion';
import {
  Link2, BarChart3, Sparkles, MonitorPlay, ShieldCheck, ArrowRight, CheckCircle2,
} from 'lucide-react';

const LAYERS = [
  {
    id: 'cad',
    num: '01',
    label: 'CAD / BIM Entegrasyonu',
    icon: Link2,
    slogan: ['Yazılımlarınızla Konuşur,', 'İş Akışınızı Bölmez.'],
    desc: 'Mevcut tasarım dosyalarınızı Archilya\'ya taşımak için ekstra iş yoktur. Projeleriniz olduğu gibi gelir, VR deneyimi olarak anında canlanır.',
    badges: ['Tek Tıkla Model Aktarımı', 'Revit / SketchUp / Rhino Uyumu', 'Kayıpsız Geometri Transferi'],
    accent: 'primary',
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1600&q=80&auto=format&fit=crop',
    align: 'left',
  },
  {
    id: 'budget',
    num: '02',
    label: 'Parametrik Maliyet & Tasarım',
    icon: BarChart3,
    slogan: ['Her Kararın Bir Bedeli Vardır.', 'Müşterinize Anında Gösterin.'],
    desc: 'VR oturumu biterken maliyet tablosu da hazırdır. Malzeme seçimi değişir, bütçe eşzamanlı güncellenir. Müşteriniz fiyatı sormadan önce siz sunarsınız.',
    badges: ['Eşzamanlı Excel / HTML Çıktısı', 'Dinamik Materyal Varyasyonları', 'Bütçe Limit Uyarı Sistemi'],
    accent: 'amber',
    image: 'https://images.unsplash.com/photo-1460472178825-e5240623afd5?w=1600&q=80&auto=format&fit=crop',
    align: 'right',
  },
  {
    id: 'ai',
    num: '03',
    label: 'AI + Sinematik Çıktı',
    icon: Sparkles,
    slogan: ['Zamanı Durdurun, Mevsimi Değiştirin.', 'AI İle Yeniden Yaratın.'],
    desc: 'Güneşi istediğiniz açıya alın, kışı yaza çevirin. Yapay zeka ile konsept alternatiflerini saniyeler içinde üretin. 4K sinematik kamerayı serbest bırakın.',
    badges: ['AI Concept Studio', '4K Sinematik Kamera', 'Gerçek Zamanlı Güneş Döngüsü'],
    accent: 'primary',
    image: 'https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=1600&q=80&auto=format&fit=crop',
    align: 'left',
  },
  {
    id: 'streaming',
    num: '04',
    label: 'Donanımsız Şov',
    icon: MonitorPlay,
    slogan: ['Müşterinizin Cihazı Ne Olursa Olsun,', 'Sizin Şovunuz Kusursuzdur.'],
    desc: 'Kurulum yok, kablo yok, güçlü bilgisayar şartı yok. Sunum linkini paylaşın; müşteriniz web tarayıcısından, tabletinden veya telefonundan anında girer.',
    badges: ['Web Tarayıcısından Anında Erişim', 'Dokunmatik Kontrol', 'Kurulum Gerektirmez'],
    accent: 'amber',
    image: 'https://images.unsplash.com/photo-1558655146-364adaf1fcc9?w=1600&q=80&auto=format&fit=crop',
    align: 'right',
  },
  {
    id: 'security',
    num: '05',
    label: 'Güvenlik & Ekip',
    icon: ShieldCheck,
    slogan: ['Fikirleriniz En Değerli Sermayenizdir.', 'Onları Korumaya Aldık.'],
    desc: 'Her proje dosyası şifrelenmiş sunucularda tutulur. Ekibiniz nerede olursa olsun aynı anda senkronize çalışır, hiçbir revizyon kaybolmaz.',
    badges: ['KVKK & GDPR Uyumlu Şifreli Sunucular', 'Save Slots', '10+ Kişilik Ekip Senkronizasyonu'],
    accent: 'primary',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&q=80&auto=format&fit=crop',
    align: 'left',
  },
];

const ACCENT = {
  primary: {
    num: 'text-primary/20',
    label: 'text-primary',
    icon: 'bg-primary/15 text-primary border-primary/25',
    line: 'bg-primary',
    badge: 'border-primary/25 bg-primary/8 text-primary/80',
    check: 'text-primary',
    glow: 'rgba(198,168,124,0.08)',
  },
  amber: {
    num: 'text-amber-400/20',
    label: 'text-amber-400',
    icon: 'bg-amber-400/15 text-amber-400 border-amber-400/25',
    line: 'bg-amber-400',
    badge: 'border-amber-400/25 bg-amber-400/8 text-amber-400/80',
    check: 'text-amber-400',
    glow: 'rgba(251,191,36,0.06)',
  },
};

function Layer({ layer }) {
  const A = ACCENT[layer.accent];
  const Icon = layer.icon;
  const isRight = layer.align === 'right';

  const textVariants = {
    hidden: { opacity: 0, x: isRight ? 60 : -60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] } },
  };

  const badgeVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.5, delay: 0.35 + i * 0.12, ease: 'easeOut' },
    }),
  };

  const numVariants = {
    hidden: { opacity: 0, scale: 0.85 },
    visible: { opacity: 1, scale: 1, transition: { duration: 1, ease: 'easeOut' } },
  };

  return (
    <section id={`feature-${layer.id}`} className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={layer.image} alt="" className="w-full h-full object-cover scale-105" loading="lazy" />
      </div>
      <div className="absolute inset-0 bg-black/75" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/80" />
      {isRight
        ? <div className="absolute inset-0 bg-gradient-to-l from-background/20 via-transparent to-background/70" />
        : <div className="absolute inset-0 bg-gradient-to-r from-background/20 via-transparent to-background/70" />
      }

      <div
        className="absolute pointer-events-none"
        style={{
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${A.glow} 0%, transparent 70%)`,
          top: '50%',
          left: isRight ? 'auto' : '5%',
          right: isRight ? '5%' : 'auto',
          transform: 'translateY(-50%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="absolute top-0 left-0 right-0 h-px bg-white/5" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/5" />

      <div className="container mx-auto px-6 relative z-10 py-24">
        <div className={`flex flex-col ${isRight ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-16 lg:gap-24`}>
          <motion.div
            variants={numVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className={`hidden lg:block text-[18vw] xl:text-[200px] font-serif font-bold leading-none select-none shrink-0 ${A.num}`}
            style={{ lineHeight: 0.85 }}
          >
            {layer.num}
          </motion.div>

          <motion.div
            variants={textVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="flex-1 max-w-2xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-9 h-9 rounded-sm border flex items-center justify-center shrink-0 ${A.icon}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-[0.35em] ${A.label}`}>
                {layer.label}
              </span>
            </div>

            <div className={`w-12 h-0.5 ${A.line} mb-8 rounded-full`} />

            <h2 className="text-4xl sm:text-5xl xl:text-6xl font-serif text-white italic leading-[1.1] mb-6">
              {layer.slogan[0]}
              <br />
              <span className={layer.accent === 'amber' ? 'text-amber-200' : 'text-primary/90'}>
                {layer.slogan[1]}
              </span>
            </h2>

            <p className="text-gray-400 text-base leading-relaxed mb-10 max-w-lg font-sans">
              {layer.desc}
            </p>

            <div className="flex flex-col gap-3">
              {layer.badges.map((badge, i) => (
                <motion.div
                  key={badge}
                  custom={i}
                  variants={badgeVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-80px' }}
                  className={`inline-flex items-center gap-2.5 self-start px-4 py-2.5 rounded-sm border backdrop-blur-sm ${A.badge}`}
                >
                  <CheckCircle2 className={`w-3.5 h-3.5 shrink-0 ${A.check}`} />
                  <span className="text-[11px] font-sans font-medium tracking-wide">{badge}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className={`absolute bottom-8 right-8 text-6xl font-serif font-bold ${A.num} lg:hidden select-none`}>
        {layer.num}
      </div>
    </section>
  );
}

export default function ProductFeatures() {
  return (
    <div id="platform">
      <section className="relative py-28 bg-background overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'radial-gradient(circle, #c6a87c 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true, margin: '-80px' }}
          >
            <p className="text-primary text-[10px] uppercase tracking-[0.4em] mb-5">
              Platform Yetenekleri
            </p>
            <h2 className="text-5xl md:text-6xl font-serif text-white italic mb-6 leading-tight">
              Mimari Ofisin<br />
              <span className="text-primary/80">Yeni Altyapısı.</span>
            </h2>
            <p className="text-gray-500 text-sm font-sans max-w-lg mx-auto leading-relaxed">
              Archilya; CAD entegrasyonundan maliyet takibine, AI stüdyosundan donanımsız
              sunuma kadar mimari ofisin tüm dijital iş akışını tek çatı altında yönetir.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            viewport={{ once: true }}
            className="mt-12 flex flex-col items-center gap-2"
          >
            <span className="text-[9px] uppercase tracking-[0.3em] text-gray-600">Kaydırın</span>
            <div className="w-px h-10 bg-gradient-to-b from-gray-600 to-transparent" />
          </motion.div>
        </div>
      </section>

      {LAYERS.map((layer, i) => (
        <Layer key={layer.id} layer={layer} index={i} />
      ))}

      <section className="relative py-24 bg-background overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/20 to-background pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary/4 rounded-full blur-[150px] pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            viewport={{ once: true, margin: '-60px' }}
            className="max-w-3xl mx-auto text-center"
          >
            <p className="text-primary text-[10px] uppercase tracking-[0.4em] mb-4">
              Tüm Yetenekler, Tek Platform
            </p>
            <h3 className="text-4xl md:text-5xl font-serif text-white italic mb-5 leading-tight">
              Ofisinize Özel Bir<br />Demo Ayarlayalım.
            </h3>
            <p className="text-gray-500 text-sm font-sans mb-10 leading-relaxed max-w-lg mx-auto">
              Yıllık abonelik planlarımızla VR kurulum, eğitim ve entegrasyon desteği dahildir.
              Hangi pakette ne alacağınızı birlikte konuşalım.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="#pricing"
                className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-black font-bold text-[11px] uppercase tracking-widest rounded-sm hover:bg-white transition-colors duration-300 whitespace-nowrap"
              >
                Abonelik Planlarını İncele
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a
                href="#contact"
                className="group inline-flex items-center gap-3 px-8 py-4 border border-white/12 text-gray-400 hover:text-white hover:border-white/30 text-[11px] uppercase tracking-widest rounded-sm transition-all duration-300 whitespace-nowrap"
              >
                Demo Talep Et
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
