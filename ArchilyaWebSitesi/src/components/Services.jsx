import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

const services = [
  {
    id: '01',
    tag: 'VR Sunum',
    title: 'Müşteriniz Projeyi İzlemesin, İçinde Yürüsün.',
    desc: '1:1 ölçekte, derinlik ve hacim algısıyla gerçekleştirilen VR turları; müşterinizin "evet" demesini beklemeden kararı o an almasını sağlar. Satış kapama oranı artar, revizyon döngüsü kısalır.',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=2070&auto=format&fit=crop',
    accent: 'primary',
  },
  {
    id: '02',
    tag: 'Canlı Malzeme & Bütçe',
    title: '"Zemin Mermer Olsa?" Sorusunu Canlı Yanıtlayın.',
    desc: 'Müşteri malzeme değiştirmek istediğinde render beklemenize gerek yok. Tek tıkla değiştirin, bütçe tablosu eşzamanlı güncellensin. Toplantı bitmeden karar alınsın.',
    image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?q=80&w=1974&auto=format&fit=crop',
    accent: 'amber',
  },
  {
    id: '03',
    tag: 'Sinematik Çıktı',
    title: 'Projenizin Hikayesini 4K ile Anlatın.',
    desc: 'Mevsim değişimleri, farklı ışık senaryoları ve sinematik kamera hareketleriyle sosyal medya, lansman ve basın bülteni için hazır 4K içerikler üretin. Render ajansına gerek kalmaz.',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=2053&auto=format&fit=crop',
    accent: 'primary',
  },
];

const ACCENT = {
  primary: {
    tag: 'text-primary border-primary/25 bg-primary/5',
    num: 'text-primary/15',
    btn: 'text-primary border-primary',
    frame: 'group-hover:border-primary/40',
    line: 'bg-primary',
  },
  amber: {
    tag: 'text-amber-400 border-amber-400/25 bg-amber-400/5',
    num: 'text-amber-400/15',
    btn: 'text-amber-400 border-amber-400',
    frame: 'group-hover:border-amber-400/40',
    line: 'bg-amber-400',
  },
};

export default function Services() {
  return (
    <section id="studio" className="py-32 bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: 'radial-gradient(circle, #c6a87c 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="container mx-auto px-6 mb-24">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true, margin: '-80px' }}
          className="flex flex-col md:flex-row justify-between items-end gap-6"
        >
          <div>
            <p className="text-primary text-[10px] uppercase tracking-[0.4em] mb-4">Avantajlar</p>
            <h2 className="text-4xl md:text-6xl font-serif text-white italic leading-tight">
              Ofisiniz İçin<br />
              <span className="text-primary/80">Somut Getiri.</span>
            </h2>
          </div>
          <p className="text-gray-500 text-sm font-sans max-w-sm leading-relaxed md:text-right">
            Archilya; tasarım sürecini hızlandıran, müşteri onayını kolaylaştıran ve
            içerik maliyetlerini düşüren üç temel avantaj sunar.
          </p>
        </motion.div>
      </div>

      <div className="space-y-28">
        {services.map((service, index) => {
          const A = ACCENT[service.accent];
          const isEven = index % 2 === 0;

          return (
            <div key={service.id} className="container mx-auto px-6">
              <div className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-14 lg:gap-20`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8 }}
                  viewport={{ once: true, margin: '-60px' }}
                  className="lg:w-1/2 relative group"
                >
                  <div className={`absolute -inset-4 border border-white/6 -z-10 transition-colors duration-500 ${A.frame}`} />
                  <div className={`absolute bottom-0 left-0 h-0.5 ${A.line} w-0 group-hover:w-full transition-all duration-700 z-10`} />

                  <div className="aspect-[4/3] overflow-hidden rounded-sm">
                    <img
                      src={service.image}
                      alt={service.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale-[40%] group-hover:grayscale-0"
                      loading="lazy"
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, x: isEven ? 36 : -36 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.15 }}
                  viewport={{ once: true, margin: '-60px' }}
                  className="lg:w-1/2"
                >
                  <span className={`block text-[80px] font-serif font-bold leading-none select-none mb-2 ${A.num}`}>
                    {service.id}
                  </span>

                  <span className={`inline-block text-[10px] font-bold uppercase tracking-[0.3em] border px-3 py-1 rounded-sm mb-5 ${A.tag}`}>
                    {service.tag}
                  </span>

                  <h3 className="text-2xl md:text-3xl font-serif text-white italic mb-5 leading-snug">
                    {service.title}
                  </h3>

                  <p className="text-gray-400 text-sm font-sans leading-relaxed mb-8">
                    {service.desc}
                  </p>

                  <a
                    href="#contact"
                    className={`group/btn inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-widest border-b pb-1 transition-colors ${A.btn}`}
                  >
                    Demo Talep Et
                    <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-1 transition-transform" />
                  </a>
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
