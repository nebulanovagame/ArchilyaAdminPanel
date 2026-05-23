import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { useRef } from 'react';

const TRUST_BADGES = [
  'Revit / SketchUp / Rhino Uyumu',
  'KVKK & GDPR Uyumlu',
  'Web Tarayıcısından Sunum',
  'Kurulum Gerektirmez',
];

export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const bgScale = useTransform(scrollYProgress, [0, 1], [1, 1.08]);
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '60%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className="relative h-screen flex items-center justify-center overflow-hidden">
      <motion.div
        className="absolute inset-0 z-0"
        style={{ y: bgY, scale: bgScale }}
      >
        <div className="absolute inset-0 bg-black/55 z-10" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-background via-background/40 to-transparent z-20 pointer-events-none" />
        <img
          src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2053&auto=format&fit=crop"
          alt="Archilya Hero Background"
          className="w-full h-full object-cover"
        />
      </motion.div>

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="container mx-auto px-6 relative z-30 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        >
          <p className="font-sans text-[10px] tracking-[0.4em] uppercase text-primary mb-6">
            Mimari Ofisler İçin VR Sunum Platformu
          </p>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white mb-6 italic leading-[1.05]">
            Projelerinizi<br />
            <span className="not-italic text-primary/90">Yaşatın.</span>
          </h1>

          <p className="max-w-xl mx-auto text-gray-300 font-light text-base md:text-lg mb-10 leading-relaxed">
            CAD dosyanızı Archilya'ya aktarın; müşteriniz projeyi ekrandan izlemek yerine
            içinde yürüsün. Sunum daha etkileyici, karar daha hızlı, revizyon daha az.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-12">
            <a
              href="#contact"
              data-cursor="Demo İste"
              className="group inline-flex items-center gap-3 bg-primary text-black px-10 py-4 rounded-sm font-sans text-[11px] font-bold uppercase tracking-widest hover:bg-white transition-all duration-300"
            >
              Ücretsiz Demo Talep Et
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#platform"
              data-cursor="Keşfet"
              className="inline-flex items-center gap-2 bg-transparent border border-white/20 text-white px-10 py-4 rounded-sm font-sans text-[11px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all duration-300"
            >
              Platformu İncele
            </a>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.7 }}
            className="flex flex-wrap items-center justify-center gap-3"
          >
            {TRUST_BADGES.map((badge) => (
              <span
                key={badge}
                className="text-[9px] font-sans uppercase tracking-[0.25em] text-gray-500 border border-white/8 bg-white/3 backdrop-blur-sm px-3 py-1.5 rounded-sm"
              >
                {badge}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 z-30"
      >
        <span className="text-[9px] uppercase tracking-[0.3em] font-sans">Kaydırın</span>
        <ChevronDown className="w-5 h-5 animate-bounce" />
      </motion.div>
    </section>
  );
}
