import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';


export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 50);
  });

  const navItems = [
    { label: 'Özellikler', href: '#platform' },
    { label: 'Portfolyo', href: '#portfolio' },
    { label: 'Hakkımızda', to: '/hakkimizda' },
    { label: 'Fiyatlandırma', href: '#pricing' },
    { label: 'Entegrasyon', href: '#workflow' },
    { label: 'İletişim', href: '#contact' },
  ];

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className={clsx(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-700',
          scrolled
            ? 'bg-[#0f1115]/80 backdrop-blur-md py-4 border-b border-white/5'
            : 'bg-transparent py-8',
        )}
      >
        <div className="container mx-auto px-6 md:px-12 flex justify-between items-center">
          <Link to="/" className="flex flex-col items-center group">
            <span className="font-serif text-2xl text-white tracking-wider italic">Archilya</span>
            <span className="text-[8px] text-primary uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-opacity">Luxury</span>
          </Link>

          <div className="hidden md:flex items-center gap-10">
            {navItems.map((item) => (
              item.to ? (
                <Link
                  key={item.label}
                  to={item.to}
                  className="text-xs font-sans font-medium text-gray-300 hover:text-primary uppercase tracking-widest transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-xs font-sans font-medium text-gray-300 hover:text-primary uppercase tracking-widest transition-colors"
                >
                  {item.label}
                </a>
              )
            ))}

            <div className="flex items-center gap-4">
              <Link
                to="/panel"
                className="text-xs font-sans font-medium text-gray-300 hover:text-primary uppercase tracking-widest transition-colors"
              >
                Giriş Yap
              </Link>
              <a
                href="#contact"
                className="text-xs font-sans font-bold text-black bg-primary px-6 py-2 rounded-sm hover:bg-white transition-colors uppercase tracking-wider"
              >
                Demo İste
              </a>
            </div>
          </div>

          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden text-white">
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#0f1115] flex flex-col items-center justify-center md:hidden"
          >
            <div className="flex flex-col gap-8 text-center">
              {navItems.map((item) => (
                item.to ? (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setIsOpen(false)}
                    className="font-serif text-4xl text-white hover:text-primary italic transition-colors"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="font-serif text-4xl text-white hover:text-primary italic transition-colors"
                  >
                    {item.label}
                  </a>
                )
              ))}

              <div className="flex flex-col items-center gap-4 pt-4 border-t border-white/10">
                <Link
                  to="/panel"
                  onClick={() => setIsOpen(false)}
                  className="font-sans text-sm text-primary uppercase tracking-widest hover:text-white transition-colors"
                >
                  Giriş Yap
                </Link>
                <Link
                  to="/panel"
                  onClick={() => setIsOpen(false)}
                  className="font-sans text-sm font-bold text-black bg-primary px-8 py-2.5 rounded-sm hover:bg-white transition-colors uppercase tracking-wider"
                >
                  Kayıt Ol
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
