import { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { submitContactFormSecure } from '../services/entitlementService';

function AnimatedInput({ type = 'text', placeholder, value, onChange, required }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative group">
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full bg-transparent border-b border-white/10 py-4 text-white placeholder-gray-600 focus:outline-none font-serif text-2xl italic transition-colors"
        placeholder={placeholder}
      />
      <motion.div
        className="absolute bottom-0 left-0 h-[1px] bg-primary"
        initial={{ width: '0%' }}
        animate={{ width: focused ? '100%' : '0%' }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </div>
  );
}

function AnimatedTextarea({ placeholder, value, onChange, required }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="relative group">
      <textarea
        rows="2"
        value={value}
        onChange={onChange}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full bg-transparent border-b border-white/10 py-4 text-white placeholder-gray-600 focus:outline-none font-serif text-2xl italic resize-none transition-colors"
        placeholder={placeholder}
      />
      <motion.div
        className="absolute bottom-0 left-0 h-[1px] bg-primary"
        initial={{ width: '0%' }}
        animate={{ width: focused ? '100%' : '0%' }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      />
    </div>
  );
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: 'easeOut' } },
};

export default function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);

    try {
      const result = await submitContactFormSecure({
        name,
        email,
        message,
        website,
      });

      if (!result?.success) {
        throw new Error('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
      }

      setSending(false);
      setName('');
      setEmail('');
      setMessage('');
      setWebsite('');

      if (result?.mailStatus === 'sent' && result?.emailConfirmationSent) {
        toast.success('Mesajınız alındı. Onay e-postası gönderildi.');
      } else if (result?.mailStatus === 'partial') {
        toast.success('Mesajınız alındı. E-posta tesliminde gecikme olabilir, ekibimiz en kısa sürede dönüş yapacak.');
      } else {
        toast.success('Mesajınız alındı. En kısa sürede dönüş yapacağız.');
      }
    } catch (err) {
      setSending(false);
      toast.error(err.message || 'Mesaj gönderilemedi.');
    }
  }

  return (
    <section id="contact" className="py-32 bg-surface relative overflow-hidden">
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-primary/4 rounded-full blur-[140px] pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <motion.h2 variants={itemVariants} className="text-5xl md:text-7xl font-serif text-white mb-8 italic">
              İletişim
            </motion.h2>
            <motion.p variants={itemVariants} className="text-gray-400 font-light text-lg mb-12 max-w-md">
              Her büyük proje bir konuşma ile başlar. Vizyonunuzu gerçeğe dönüştürmek için buradayız.
            </motion.p>

            <div className="space-y-6">
              <motion.div variants={itemVariants} className="flex flex-col group">
                <span className="text-primary text-xs uppercase tracking-widest mb-1">E-posta</span>
                <a
                  href="mailto:info@nebulanovagames.com"
                  data-cursor="Yaz"
                  className="text-white text-xl font-serif hover:text-primary transition-colors duration-300"
                >
                  info@nebulanovagames.com
                </a>
              </motion.div>
              <motion.div variants={itemVariants} className="flex flex-col">
                <span className="text-primary text-xs uppercase tracking-widest mb-1">Telefon</span>
                <a
                  href="tel:+902826060639"
                  className="text-white text-xl font-serif hover:text-primary transition-colors duration-300"
                >
                  0 (282) 606 06 39
                </a>
              </motion.div>
              <motion.div variants={itemVariants} className="flex flex-col">
                <span className="text-primary text-xs uppercase tracking-widest mb-1">Adres</span>
                <span className="text-white font-serif leading-relaxed" style={{ fontSize: '1rem' }}>
                  Silahtar&#x131;ağa Mah. Üniversite 1. Sk.<br />
                  No:13/1 İç Kapı No:Z109<br />
                  59000 Çorlu / TEKİRDAĞ
                </span>
              </motion.div>
              <motion.div variants={itemVariants} className="flex flex-col">
                <span className="text-primary text-xs uppercase tracking-widest mb-1">Şirket</span>
                <span className="text-gray-400 font-sans text-xs leading-relaxed max-w-xs">
                  NEBULA NOVA GAMES DIŞ TİCARET LİMİTED ŞİRKETİ
                </span>
              </motion.div>
            </div>
          </motion.div>

          <motion.form
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            onSubmit={handleSubmit}
            className="space-y-8"
          >
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />

            <motion.div variants={itemVariants}>
              <AnimatedInput
                type="text"
                placeholder="İsim"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <AnimatedInput
                type="email"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <AnimatedTextarea
                placeholder="Proje Notları"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <button
                type="submit"
                disabled={sending}
                data-cursor="Gönder"
                className="flex items-center gap-3 text-white border-b border-white pb-2 hover:text-primary hover:border-primary transition-colors uppercase tracking-widest text-xs font-bold mt-8 disabled:opacity-50"
              >
                {sending && (
                  <span className="w-3 h-3 border border-white/30 border-t-primary rounded-full animate-spin" />
                )}
                {sending ? 'Gönderiliyor...' : 'Mesaj Gönder'}
              </button>
            </motion.div>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
