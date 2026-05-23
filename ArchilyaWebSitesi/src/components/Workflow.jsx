import { motion } from 'framer-motion';
import {
  Plug, Settings2, GraduationCap, MessageSquareHeart, ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';

const STEPS = [
  {
    id: '01',
    icon: Plug,
    title: 'Panel Kurulumu & Bulut Entegrasyonu',
    subtitle: 'Onboarding',
    desc: 'Aboneliğiniz başlar başlamaz ofisiniz Archilya Bulut Paneline entegre edilir. Size özel atanan Proje Yöneticisi, bir kickoff toplantısıyla donanım altyapınızı inceler ve ofisinizin ihtiyacına göre en verimli kurguyu belirler.',
    details: [
      'Ofisinize Özel Bulut Alanı Tanımlaması',
      'Ekip Erişim Yetkilendirmesi',
      'Donanım ve İhtiyaç Analizi (Kickoff)',
    ],
    media: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80&auto=format&fit=crop',
    side: 'left',
  },
  {
    id: '02',
    icon: Settings2,
    title: 'Archilya Launcher & Cihaz Optimizasyonu',
    subtitle: 'Kurulum',
    desc: 'Sunum yapacağınız cihazlara Archilya Launcher saniyeler içinde kurulur. Mevcut projeleriniz güvenli bulut sunucularımızla eşzamanlanmaya başlar. Artık tüm projeleriniz bulutta güvende ve versiyon kontrollüdür.',
    details: [
      'Çoklu Cihaz Kurulumu (Klavye / Touch / Gamepad)',
      'Mevcut Dosyaların Buluta Senkronizasyonu',
      'Sürüm Geçmişi & Save Slot Yapılandırması',
    ],
    media: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80&auto=format&fit=crop',
    side: 'right',
  },
  {
    id: '03',
    icon: GraduationCap,
    title: 'Eğitim, Senaryo & Maliyet Kalibrasyonu',
    subtitle: 'Archilya Akademi',
    desc: 'Ekibiniz için canlı eğitim seansları düzenlenir. İnteraktif kat planları, eşzamanlı ve interaktif bütçe yönetimi, sinematik kamera ile çıktı alma ve yapay zeka araçlarıyla konsept üretimi birebir öğretilir.',
    details: [
      'VR Kontrolleri & İnteraktif Mekan Yürüyüşü',
      'Canlı Maliyet Takibi & Rapor Üretimi',
      'AI Stüdyo Araçları & Konsept Üretimi',
    ],
    media: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=80&auto=format&fit=crop',
    side: 'left',
  },
  {
    id: '04',
    icon: MessageSquareHeart,
    title: 'Canlı Sunum & Kesintisiz Destek',
    subtitle: 'Sürekli Gelişim',
    desc: 'Archilya sadece bir yazılım değil, çözüm ortağınızdır. İlk projenizi müşterinize sunduktan sonra yalnız değilsiniz. Panel üzerinden anlık geri bildirim iletebilir, yapay zeka araçlarınızı ve VR senaryolarınızı sürekli geliştirebilirsiniz.',
    details: [
      'Panel İçi Anlık Mesajlaşma & Destek Talebi',
      'Revizyon & Geri Bildirim Takip Sistemi',
      'Periyodik AI & VR Özellik Güncellemeleri',
    ],
    media: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=800&q=80&auto=format&fit=crop',
    side: 'right',
  },
];

function StepCard({ step, index }) {
  const isLeft = step.side === 'left';

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: index * 0.07, ease: 'easeOut' }}
      viewport={{ once: true, margin: '-50px' }}
      className="grid grid-cols-1 md:grid-cols-[1fr_80px_1fr] items-center gap-0"
    >
      <div className="md:pr-8">{isLeft ? <ContentCard step={step} /> : <MediaCard step={step} />}</div>

      <div className="hidden md:flex flex-col items-center self-stretch relative z-10">
        <div className={clsx('w-px flex-1', index === 0 ? 'bg-transparent' : 'bg-gradient-to-b from-primary/20 to-primary/50')} />

        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: index * 0.1 + 0.2 }}
          viewport={{ once: true }}
          className="relative flex items-center justify-center shrink-0 my-5"
        >
          <div className="absolute w-14 h-14 rounded-full border border-primary/12 bg-primary/4" />
          <div className="relative z-10 w-10 h-10 rounded-full bg-background border border-primary/40 flex items-center justify-center shadow-[0_0_20px_rgba(198,168,124,0.15)] hover:shadow-[0_0_32px_rgba(198,168,124,0.28)] hover:border-primary/70 transition-all duration-500 group">
            <step.icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform duration-300" />
          </div>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-primary/45 uppercase tracking-widest whitespace-nowrap font-mono">{step.id}</span>
        </motion.div>

        <div className={clsx('w-px flex-1', index === STEPS.length - 1 ? 'bg-transparent' : 'bg-gradient-to-b from-primary/50 to-primary/15')} />
      </div>

      <div className="md:pl-8">{isLeft ? <MediaCard step={step} /> : <ContentCard step={step} />}</div>

      <div className="md:hidden col-span-full mt-4 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-full bg-background border border-primary/40 flex items-center justify-center shrink-0">
            <step.icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[9px] font-bold text-primary/50 uppercase tracking-widest font-mono">{step.id} — {step.subtitle}</span>
        </div>
        <MediaCard step={step} mobile />
        <ContentCard step={step} mobile />
      </div>
    </motion.div>
  );
}

function MediaCard({ step, mobile }) {
  return (
    <div className={clsx('relative rounded-sm overflow-hidden border border-white/8 group', mobile ? 'aspect-video' : 'aspect-[4/3]')}>
      <img src={step.media} alt={step.title} className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-[1.03] transition-all duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute top-0 left-0 w-5 h-5 border-t border-l border-primary/30" />
      <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r border-primary/30" />
      <div className="absolute bottom-3 left-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60 bg-black/40 px-2 py-0.5 rounded-sm backdrop-blur-sm border border-primary/15">{step.subtitle}</span>
      </div>
      <div className="absolute bottom-3 right-3">
        <span className="text-[8px] text-white/20 uppercase tracking-widest">Placeholder</span>
      </div>
    </div>
  );
}

function ContentCard({ step, mobile }) {
  return (
    <div className={clsx('p-6 rounded-sm border bg-surface/40 backdrop-blur-sm border-white/6', 'hover:border-primary/25 hover:shadow-[0_0_20px_rgba(198,168,124,0.07)] transition-all duration-400', mobile && 'mt-0')}>
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-primary mb-2">{step.subtitle}</p>
      <h3 className="text-lg font-serif text-white italic mb-3 leading-snug">{step.title}</h3>
      <p className="text-gray-500 text-xs leading-relaxed mb-5">{step.desc}</p>
      <ul className="space-y-2">
        {step.details.map((d, i) => (
          <li key={i} className="flex items-center gap-2.5 text-[11px] text-gray-400">
            <ArrowRight className="w-3 h-3 text-primary shrink-0" />
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Workflow() {
  return (
    <section id="workflow" className="py-32 bg-surface relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[280px] bg-primary/4 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-8"
        >
          <p className="text-primary text-xs uppercase tracking-[0.3em] mb-4">Entegrasyon</p>
          <h2 className="text-4xl md:text-5xl font-serif text-white italic mb-4">Archilya'ya Nasıl Başlarsınız?</h2>
          <p className="text-gray-500 text-sm font-sans max-w-xl mx-auto leading-relaxed">
            Ofisinizi geleneksel yöntemlerden kurtarıp dijital şov dünyasına geçirmek için
            hazırladığımız 4 adımlık pürüzsüz entegrasyon süreci.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          viewport={{ once: true }}
          className="flex justify-center mb-20"
        >
          <div className="inline-flex items-center gap-3 px-5 py-2.5 border border-primary/20 rounded-sm bg-primary/5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.28em]">Pro &amp; Studio Abonelere Entegrasyon Süreci Ücretsizdir</span>
          </div>
        </motion.div>

        <div className="relative max-w-5xl mx-auto space-y-6 md:space-y-2">
          {STEPS.map((step, i) => (
            <StepCard key={step.id} step={step} index={i} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="text-center mt-20"
        >
          <p className="text-gray-600 text-xs font-sans mb-6 uppercase tracking-widest">Adım atmaya hazır mısınız?</p>
          <a href="#pricing" className="group inline-flex items-center gap-3 px-8 py-4 bg-primary text-black font-bold text-xs uppercase tracking-widest rounded-sm hover:bg-white transition-colors duration-300">
            Abonelik Planlarını İncele
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
