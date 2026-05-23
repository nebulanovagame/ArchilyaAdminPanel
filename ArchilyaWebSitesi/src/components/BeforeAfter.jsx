import { useState } from 'react';
import { motion } from 'framer-motion';
import { MoveHorizontal } from 'lucide-react';

export default function BeforeAfter() {
  const [sliderPosition, setSliderPosition] = useState(50);

  return (
    <section className="py-32 bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px] bg-primary/3 rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          viewport={{ once: true, margin: '-80px' }}
          className="text-center mb-16"
        >
          <p className="text-primary text-[10px] uppercase tracking-[0.4em] mb-4">Önce & Sonra</p>
          <h2 className="text-4xl md:text-5xl font-serif text-white italic mb-4">
            CAD'den Gerçekliğe.<br />
            <span className="text-primary/80">Tek Platform.</span>
          </h2>
          <p className="text-gray-500 text-sm font-sans max-w-md mx-auto leading-relaxed">
            Mevcut BIM dosyanızı Archilya'ya aktarın. Saniyeler içinde fotorealistik,
            interaktif bir VR deneyimine dönüşsün.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          viewport={{ once: true, margin: '-60px' }}
        >
          <div className="relative w-full aspect-[16/9] md:aspect-[21/9] overflow-hidden rounded-sm select-none group border border-white/6">
            <img
              src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2053&auto=format&fit=crop"
              alt="Fotorealistik VR Render"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            <div
              className="absolute top-6 right-6 bg-black/60 backdrop-blur-md border border-primary/20 px-4 py-2 text-primary text-[10px] font-bold uppercase tracking-widest pointer-events-none z-10 transition-opacity duration-300 rounded-sm"
              style={{ opacity: sliderPosition < 92 ? 1 : 0 }}
            >
              Archilya VR Render
            </div>

            <img
              src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=2053&auto=format&fit=crop"
              alt="BIM / CAD Modeli"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{
                filter: 'grayscale(85%) contrast(110%) brightness(110%)',
                clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
              }}
            />
            <div
              className="absolute top-6 left-6 bg-white/90 backdrop-blur-md border border-white/20 px-4 py-2 text-black text-[10px] font-bold uppercase tracking-widest pointer-events-none z-10 transition-opacity duration-200 rounded-sm"
              style={{ opacity: sliderPosition > 8 ? 1 : 0 }}
            >
              BIM / CAD Dosyası
            </div>

            <div
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md border border-white/10 px-4 py-2 text-gray-400 text-[10px] font-sans uppercase tracking-widest pointer-events-none z-10 rounded-sm whitespace-nowrap"
              style={{ opacity: sliderPosition > 20 && sliderPosition < 80 ? 1 : 0, transition: 'opacity 0.3s' }}
            >
              Sürükleyin
            </div>

            <div
              className="absolute top-0 bottom-0 w-px bg-primary pointer-events-none z-20"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute inset-0 w-px bg-primary blur-[4px] opacity-70" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-[0_0_36px_rgba(198,168,124,0.7)] z-30">
                <MoveHorizontal className="w-5 h-5 text-black" />
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 z-30"
              style={{ cursor: 'ew-resize' }}
            />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-center justify-between gap-4 mt-6 px-1"
          >
            <p className="text-gray-600 text-xs font-sans">
              Kaydırarak BIM modelinden fotorealistik VR sahnesine geçişi inceleyin.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-px bg-gray-500" />
                <span className="text-gray-600 text-[10px] uppercase tracking-widest">BIM / CAD</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-px bg-primary" />
                <span className="text-primary text-[10px] uppercase tracking-widest">Archilya VR</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
