import { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useInView, useSpring } from 'framer-motion';
import { ArrowRight, ArrowUpRight } from 'lucide-react';

function useCounter(target, duration = 2000, start = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;

    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [start, target, duration]);

  return count;
}

const STATS = [
  { value: 120, suffix: '+', label: 'Aktif Mimari Ofis' },
  { value: 400, suffix: '+', label: 'Teslim Edilen VR Projesi' },
  { value: 40, suffix: '%', label: 'Daha Hızlı Müşteri Onayı' },
  { value: 98, suffix: '%', label: 'Müşteri Memnuniyeti' },
];

const CASE_STUDIES = [
  {
    id: '01',
    title: 'Bosphorus Residence',
    category: 'Lüks Konut',
    location: 'İstanbul, TR',
    accent: 'primary',
    image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=2071&auto=format&fit=crop',
    challenge: 'Müşteri, zemin ve duvar malzemelerini tekrar tekrar değiştirip karar veremiyor, her revizyon 3–5 gün sürüyordu.',
    solution: 'Archilya VR Tasarım Modu ile malzeme seçimi sunum içinde canlı yapıldı. Bütçe barı eşzamanlı güncellendi.',
    result: '2 Saatte Satış Kapama',
    resultSub: 'Müşteri, VR turunda 3 malzeme kombinasyonu denedi ve toplantı bitmeden imzaladı.',
    tags: ['Canlı Malzeme Değişimi', 'Bütçe Takibi', 'VR Sunum'],
  },
  {
    id: '02',
    title: 'Marina Tower',
    category: 'Ofis & Ticari',
    location: 'Dubai, UAE',
    accent: 'amber',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?q=80&w=2070&auto=format&fit=crop',
    challenge: 'Yatırımcılar farklı ülkelerdeydi. Statik PDF renderlar üzerinden karar almak güçtü, toplantı planlamak ay alıyordu.',
    solution: 'Archilya\'nın web tarayıcısı üzerinden anında erişilen VR turu ile yatırımcılar sunum linkini alıp kendi cihazlarından gezdi.',
    result: '3 Ülke, 1 Toplantı',
    resultSub: 'Sunum linki paylaşıldı; Londra, Dubai ve İstanbul\'daki yatırımcılar eşzamanlı turu tamamladı.',
    tags: ['Donanımsız Sunum', 'Uzaktan Erişim', 'Çok Kullanıcılı'],
  },
  {
    id: '03',
    title: 'Kültür Parkı Pavyonu',
    category: 'Kültürel Yapı',
    location: 'Ankara, TR',
    accent: 'primary',
    image: 'https://images.unsplash.com/photo-1599809275372-b4036fa0954b?q=80&w=2070&auto=format&fit=crop',
    challenge: 'Belediye kuruluna sunum yapılacaktı. Mevcut 2D çizimler ve statik görseller projenin etkisini yeterince aktaramıyordu.',
    solution: 'Farklı mevsim ve ışık senaryolarıyla güçlendirilmiş 4K sinematik çıktı ve VR turu belediye salonunda canlı gösterildi.',
    result: 'İlk Toplantıda Onay',
    resultSub: 'Belediye kurulu oybirliğiyle onayladı. Standart 3 toplantılık süreç tek oturuma indi.',
    tags: ['4K Sinematik Çıktı', 'Senaryo Geçişi', 'Kurul Sunumu'],
  },
  {
    id: '04',
    title: 'Aegean Villa Estate',
    category: 'Tatil Konutu',
    location: 'Bodrum, TR',
    accent: 'amber',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?q=80&w=2070&auto=format&fit=crop',
    challenge: 'Proje; 12 farklı villa tipini kapsıyordu. Her opsiyonu ayrı ayrı sunmak haftalar alacaktı ve maliyet karşılaştırması yapılamıyordu.',
    solution: 'Archilya VR\'ın çoklu ünite desteğiyle tüm 12 villa tipi tek projede toplandı. Malzeme ve bütçe karşılaştırması tek ekranda yapıldı.',
    result: '%60 Daha Az Revizyon',
    resultSub: 'Müşteri tüm opsiyonları ilk turda gördü, bütçe sınırını aşmadan tercihini belirledi.',
    tags: ['Çoklu Ünite', 'Maliyet Karşılaştırma', 'Bütçe Limiti'],
  },
];

function StatItem({ stat, started, index }) {
  const count = useCounter(stat.value, 1800 + index * 100, started);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      viewport={{ once: true }}
      className="flex flex-col items-center text-center px-6 relative group"
    >
      {index > 0 && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-12 w-px bg-white/8 hidden md:block" />}
      <span className="text-6xl md:text-7xl font-serif text-white italic leading-none mb-2 group-hover:text-primary transition-colors duration-500">
        {count}
        <span className="text-primary">{stat.suffix}</span>
      </span>
      <span className="text-[10px] uppercase tracking-[0.35em] text-gray-500 font-sans">{stat.label}</span>
    </motion.div>
  );
}

function HorizontalCaseStudies() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const cardCount = CASE_STUDIES.length;
  const xRaw = useTransform(scrollYProgress, [0, 1], ['0vw', `-${(cardCount - 1) * 100}vw`]);
  const x = useSpring(xRaw, { stiffness: 80, damping: 20, mass: 0.5 });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div ref={containerRef} style={{ height: `${cardCount * 100}vh` }} className="relative">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-white/5 z-50">
          <motion.div style={{ width: progressWidth }} className="h-full bg-primary" />
        </div>

        <motion.div style={{ x, width: `${cardCount * 100}vw`, display: 'flex', height: '100%' }}>
          {CASE_STUDIES.map((cs, i) => (
            <CaseStudyCard key={cs.id} cs={cs} index={i} cardCount={cardCount} scrollYProgress={scrollYProgress} />
          ))}
        </motion.div>

        <motion.div className="absolute bottom-8 right-10 z-50 flex items-center gap-3">
          <span className="text-gray-600 text-[10px] uppercase tracking-widest font-sans">Proje</span>
          <div className="flex gap-2">
            {CASE_STUDIES.map((_, i) => {
              const dotStart = i / cardCount;
              const dotEnd = (i + 1) / cardCount;
              return <DotIndicator key={i} scrollYProgress={scrollYProgress} start={dotStart} end={dotEnd} />;
            })}
          </div>
        </motion.div>

        <motion.div style={{ opacity: useTransform(scrollYProgress, [0, 0.1], [1, 0]) }} className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
          <div className="flex items-center gap-2 text-gray-600">
            <span className="text-[10px] uppercase tracking-widest font-sans">Kaydırarak Gezin</span>
            <div className="flex gap-1">
              <div className="w-4 h-px bg-gray-600" />
              <div className="w-2 h-px bg-primary" />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function DotIndicator({ scrollYProgress, start, end }) {
  const opacity = useTransform(scrollYProgress, [start, (start + end) / 2, end], [0.25, 1, 0.25]);
  const width = useTransform(scrollYProgress, [start, (start + end) / 2, end], [12, 28, 12]);
  return <motion.div style={{ opacity, width }} className="h-px bg-primary rounded-full transition-all" />;
}

function CaseStudyCard({ cs, index, cardCount, scrollYProgress }) {
  const isAmber = cs.accent === 'amber';
  const accentColor = isAmber ? 'text-amber-400' : 'text-primary';
  const accentBorder = isAmber ? 'border-amber-400/30' : 'border-primary/30';
  const accentBg = isAmber ? 'bg-amber-400/10' : 'bg-primary/10';
  const accentLine = isAmber ? 'bg-amber-400' : 'bg-primary';
  const accentTag = isAmber ? 'border-amber-400/20 text-amber-400/70' : 'border-primary/20 text-primary/70';

  const start = index / cardCount;
  const end = (index + 1) / cardCount;

  const cardOpacity = useTransform(scrollYProgress, [Math.max(0, start - 0.05), start, Math.min(1, end - 0.05), end], [0.4, 1, 1, 0.4]);
  const contentY = useTransform(scrollYProgress, [Math.max(0, start - 0.08), start], [40, 0]);

  return (
    <motion.div style={{ opacity: cardOpacity, width: '100vw', flexShrink: 0, height: '100%', position: 'relative' }} className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={cs.image} alt={cs.title} className="w-full h-full object-cover" loading={index === 0 ? 'eager' : 'lazy'} />
      </div>

      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30" />

      <div
        className="absolute pointer-events-none"
        style={{
          width: 700,
          height: 700,
          borderRadius: '50%',
          background: isAmber
            ? 'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(198,168,124,0.07) 0%, transparent 70%)',
          top: '50%',
          left: '15%',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="absolute top-10 left-12 z-20">
        <span className={`font-mono text-[11px] uppercase tracking-[0.4em] ${accentColor} opacity-60`}>{cs.id} / 0{cardCount}</span>
      </div>

      <div className="absolute top-10 right-12 z-20">
        <span className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-sans">{cs.location}</span>
      </div>

      <motion.div style={{ y: contentY }} className="absolute inset-0 z-20 flex items-end">
        <div className="container mx-auto px-10 md:px-16 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-1.5 h-1.5 rounded-full ${accentLine}`} />
                <span className={`text-[10px] uppercase tracking-[0.4em] ${accentColor} font-sans`}>{cs.category}</span>
              </div>

              <div className={`w-10 h-0.5 ${accentLine} mb-6 rounded-full`} />

              <h2 className="text-5xl md:text-6xl xl:text-7xl font-serif text-white italic leading-[1.05] mb-8">{cs.title}</h2>

              <div className={`border-l-2 ${accentBorder} pl-5 mb-6`}>
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-sans mb-2">Zorluk</p>
                <p className="text-gray-300 text-sm font-sans leading-relaxed">{cs.challenge}</p>
              </div>

              <div className="pl-5 mb-8">
                <p className="text-[10px] uppercase tracking-[0.3em] text-gray-600 font-sans mb-2">Archilya Çözümü</p>
                <p className="text-gray-400 text-sm font-sans leading-relaxed">{cs.solution}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {cs.tags.map((tag) => (
                  <span key={tag} className={`text-[9px] font-sans uppercase tracking-widest border px-3 py-1.5 rounded-sm backdrop-blur-sm ${accentTag} ${accentBg}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start lg:items-end">
              <div className={`relative p-8 rounded-sm border ${accentBorder} bg-black/40 backdrop-blur-md max-w-sm w-full`}>
                <div className={`absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 ${accentBorder}`} />
                <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 ${accentBorder}`} />

                <p className="text-[9px] uppercase tracking-[0.35em] text-gray-600 font-sans mb-4">Sonuç</p>
                <p className={`text-3xl md:text-4xl font-serif italic mb-3 leading-tight ${accentColor}`}>{cs.result}</p>
                <p className="text-gray-400 text-xs font-sans leading-relaxed mb-6">{cs.resultSub}</p>

                <a href="#contact" className={`group/cta inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${accentColor} border-b pb-0.5 ${accentBorder} hover:gap-3 transition-all duration-300`}>
                  Siz de Başlayın
                  <ArrowUpRight className="w-3 h-3 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5 transition-transform" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className={`absolute bottom-0 left-0 right-0 h-px ${accentLine} opacity-20`} />
    </motion.div>
  );
}

export default function Portfolio() {
  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, { once: true, margin: '-80px' });

  return (
    <section id="portfolio" className="bg-black relative">
      <div className="relative bg-surface border-b border-white/5 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-amber-400/3 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] bg-primary/4 rounded-full blur-[150px] pointer-events-none" />

        <div className="container mx-auto px-6 py-24 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} viewport={{ once: true, margin: '-60px' }} className="text-center mb-20">
            <p className="text-primary text-[10px] uppercase tracking-[0.4em] mb-4">Referanslar</p>
            <h2 className="text-5xl md:text-7xl font-serif text-white italic leading-tight mb-4">Sayılarla Archilya.</h2>
            <p className="text-gray-600 text-sm font-sans max-w-sm mx-auto leading-relaxed">Mimari ofislerin Archilya ile elde ettiği somut sonuçlar.</p>
          </motion.div>

          <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <StatItem key={stat.label} stat={stat} started={statsInView} index={i} />
            ))}
          </div>
        </div>
      </div>

      <div className="relative bg-black py-20 border-b border-white/5">
        <div className="container mx-auto px-6">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }} viewport={{ once: true, margin: '-60px' }} className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
            <div>
              <p className="text-primary text-[10px] uppercase tracking-[0.4em] mb-3">Başarı Hikayeleri</p>
              <h3 className="text-3xl md:text-5xl font-serif text-white italic leading-tight">
                Archilya ile<br />
                <span className="text-primary/80">Kazanılan Projeler.</span>
              </h3>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-8 h-px bg-white/10" />
              <p className="text-xs font-sans max-w-xs leading-relaxed text-right">
                Kaydırarak her projenin hikayesini ve elde edilen sonucu inceleyin.
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      <HorizontalCaseStudies />

      <div className="relative bg-surface border-t border-white/5 py-24 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-6 relative z-10">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} viewport={{ once: true, margin: '-60px' }} className="flex flex-col md:flex-row items-center justify-between gap-10">
            <div>
              <p className="text-primary text-[10px] uppercase tracking-[0.4em] mb-3">Sırada Siz Var</p>
              <h3 className="text-3xl md:text-4xl font-serif text-white italic leading-tight">
                Kendi Başarı Hikayenizi<br />Birlikte Yazalım.
              </h3>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4 shrink-0">
              <a href="#contact" className="group inline-flex items-center gap-3 bg-primary text-black px-8 py-4 rounded-sm font-bold text-[11px] uppercase tracking-widest hover:bg-white transition-colors duration-300 whitespace-nowrap">
                Ücretsiz Demo Talep Et
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#pricing" className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-[11px] uppercase tracking-widest transition-colors duration-300 whitespace-nowrap">
                Fiyatlandırmayı İncele
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
