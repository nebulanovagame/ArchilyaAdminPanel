import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';


const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#0a0c0f] border-t border-white/5 relative overflow-hidden">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[200px] bg-primary/3 rounded-full blur-[100px] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          className="py-16 grid grid-cols-1 md:grid-cols-4 gap-12 border-b border-white/5"
        >
          <motion.div variants={itemVariants} className="md:col-span-2">
            <Link to="/" className="inline-flex flex-col mb-4">
              <span className="font-serif text-3xl text-white italic tracking-wide">Archilya</span>
              <span className="text-[9px] text-primary uppercase tracking-[0.3em] mt-0.5">Luxury</span>
            </Link>
            <p className="text-xs text-gray-600 font-sans leading-relaxed mt-4 mb-6 max-w-[280px]">
              BIM odaklı proje yönetim ve otomasyon platformu. Mimarlık ofisleri için.
            </p>

            <div className="space-y-3">
              <p className="text-[10px] text-gray-500 font-sans uppercase tracking-[0.2em] mb-3">
                NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ
              </p>
              <div className="flex items-start gap-2 text-gray-600">
                <MapPin className="w-3.5 h-3.5 text-primary/60 shrink-0 mt-0.5" />
                <span className="text-[11px] font-sans leading-relaxed">
                  Silahtar&#x131;ağa Mah. Üniversite 1. Sk. No:13/1 İç Kapı No:Z109<br />
                  59000 Çorlu / TEKİRDAĞ
                </span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Phone className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                <a href="tel:+902826060639" className="text-[11px] font-sans hover:text-primary transition-colors">
                  0 (282) 606 06 39
                </a>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Mail className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                <a href="mailto:info@nebulanovagames.com" className="text-[11px] font-sans hover:text-primary transition-colors">
                  info@nebulanovagames.com
                </a>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants}>
            <p className="text-[10px] font-sans font-bold text-gray-500 uppercase tracking-[0.25em] mb-5">Platform</p>
            <ul className="space-y-3">
              {[
                { label: 'Özellikler', href: '#platform' },
                { label: 'Portfolyo', href: '#portfolio' },
                { label: 'Hakkımızda', to: '/hakkimizda' },
                { label: 'Fiyatlandırma', href: '#pricing' },
                { label: 'Entegrasyon', href: '#workflow' },
                { label: 'İletişim', href: '#contact' },
              ].map((item) => (
                <li key={item.label}>
                  {item.to ? (
                    <Link
                      to={item.to}
                      className="text-xs font-sans text-gray-500 hover:text-primary transition-colors uppercase tracking-widest"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <a
                      href={item.href}
                      className="text-xs font-sans text-gray-500 hover:text-primary transition-colors uppercase tracking-widest"
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div variants={itemVariants}>
            <p className="text-[10px] font-sans font-bold text-gray-500 uppercase tracking-[0.25em] mb-5">Hesap</p>
            <ul className="space-y-3 mb-8">
              {[
                { label: 'Giriş Yap', to: '/panel' },
                { label: 'Kayıt Ol', to: '/panel' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="text-xs font-sans text-gray-500 hover:text-primary transition-colors uppercase tracking-widest"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="text-[10px] font-sans font-bold text-gray-500 uppercase tracking-[0.25em] mb-4">Yasal</p>
            <ul className="space-y-3 mb-8">
              {[
                { label: 'Gizlilik Politikası', to: '/gizlilik-politikasi' },
                { label: 'KVKK', to: '/kvkk' },
                { label: 'Kullanım Koşulları', to: '/kullanim-kosullari' },
                { label: 'İptal ve İade', to: '/iptal-iade' },
                { label: 'Mesafeli Satış Sözleşmesi', to: '/mesafeli-satis' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    className="text-xs font-sans text-gray-500 hover:text-primary transition-colors uppercase tracking-widest"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <p className="text-[10px] font-sans font-bold text-gray-500 uppercase tracking-[0.25em] mb-4">Sosyal</p>
            <div className="flex gap-5">
              {['Instagram', 'LinkedIn', 'Vimeo'].map((social) => (
                <a
                  key={social}
                  href="#"
                  data-cursor={social}
                  className="text-xs font-sans text-gray-500 hover:text-primary transition-colors uppercase tracking-widest"
                >
                  {social}
                </a>
              ))}
            </div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="py-6 border-b border-white/5"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[10px] text-gray-700 font-sans uppercase tracking-widest">
              Güvenli Ödeme
            </p>
            <div className="flex items-center gap-4">
              <div className="bg-white/5 border border-white/8 rounded px-3 py-1.5 flex items-center">
                <svg width="40" height="14" viewBox="0 0 40 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16.5 13.2H13.4L15.3 0.8H18.4L16.5 13.2Z" fill="#E8E8E8"/>
                  <path d="M25.4 1.1C24.8 0.8 23.8 0.5 22.6 0.5C19.5 0.5 17.3 2.1 17.3 4.4C17.3 6.1 18.8 7 20 7.7C21.2 8.4 21.6 8.9 21.6 9.5C21.6 10.4 20.5 10.9 19.5 10.9C18.1 10.9 17.3 10.7 16.2 10.2L15.8 10L15.3 13C16.1 13.4 17.5 13.7 19 13.7C22.3 13.7 24.5 12.1 24.5 9.7C24.5 8.4 23.7 7.4 22 6.6C20.9 5.9 20.3 5.5 20.3 4.9C20.3 4.4 20.8 3.8 22 3.8C23 3.8 23.7 4 24.3 4.3L24.6 4.5L25.4 1.1Z" fill="#E8E8E8"/>
                  <path d="M29.4 8.8C29.7 7.9 30.9 4.6 30.9 4.6C30.9 4.6 31.2 3.8 31.4 3.2L31.7 4.5C31.7 4.5 32.4 8 32.6 8.8H29.4ZM33.8 0.8H31.4C30.7 0.8 30.1 1 29.8 1.8L25.2 13.2H28.5L29.2 11H33.2L33.6 13.2H36.6L33.8 0.8Z" fill="#E8E8E8"/>
                  <path d="M13.3 0.8L10.2 9.2L9.9 7.7C9.3 5.8 7.5 3.8 5.5 2.8L8.4 13.2H11.7L16.6 0.8H13.3Z" fill="#E8E8E8"/>
                  <path d="M7.3 0.8H2.3L2.2 1.1C6.1 2.1 8.7 4.5 9.9 7.7L8.6 1.8C8.4 1 7.8 0.8 7.3 0.8Z" fill="#E8E8E8"/>
                </svg>
              </div>
              <div className="bg-white/5 border border-white/8 rounded px-3 py-1.5 flex items-center gap-1">
                <div className="w-5 h-5 rounded-full bg-red-500/70" />
                <div className="w-5 h-5 rounded-full bg-amber-400/70 -ml-2" />
              </div>
              <div className="bg-white/5 border border-white/8 rounded px-3 py-1.5">
                <span className="text-[11px] font-bold text-gray-400 tracking-widest">TROY</span>
              </div>
              <div className="bg-white/5 border border-white/8 rounded px-3 py-1.5 flex items-center justify-center">
                <img src="/iyzico_logo_white.svg" alt="iyzico ile öde" className="h-4 object-contain" />
              </div>
              <div className="bg-white/5 border border-white/8 rounded px-3 py-1.5 flex items-center gap-1.5">
                <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2V7a3 3 0 016 0z" clipRule="evenodd"/>
                </svg>
                <span className="text-[10px] text-emerald-400 font-bold">256-bit SSL</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          viewport={{ once: true }}
          className="py-6 flex flex-col md:flex-row justify-between items-center gap-3"
        >
          <p className="text-[11px] text-gray-700 font-sans">
            © {year} Archilya · Nebula Nova Games Dış Ticaret Ltd. Şti. Tüm hakları saklıdır.
          </p>
          <div className="flex gap-6 flex-wrap justify-center">
            {[
              { label: 'Gizlilik Politikası', to: '/gizlilik-politikasi' },
              { label: 'KVKK', to: '/kvkk' },
              { label: 'Kullanım Koşulları', to: '/kullanim-kosullari' },
              { label: 'İptal ve İade', to: '/iptal-iade' },
              { label: 'Mesafeli Satış', to: '/mesafeli-satis' },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="text-[11px] text-gray-700 hover:text-gray-500 font-sans transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </footer>
  );
}
