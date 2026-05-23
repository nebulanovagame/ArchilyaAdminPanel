import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wrench, Heart, Sparkles, ArrowUpRight, ArrowLeft } from 'lucide-react';

function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    class Particle {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.2 + 0.3;
        this.speedX = (Math.random() - 0.5) * 0.15;
        this.speedY = (Math.random() - 0.5) * 0.15;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.gold = Math.random() > 0.7;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
          this.reset();
        }
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.gold
          ? `rgba(198,168,124,${this.opacity})`
          : `rgba(255,255,255,${this.opacity * 0.4})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < 80; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      // Draw subtle connecting lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(198,168,124,${0.03 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.8 }}
    />
  );
}

function ConstructionBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 px-5 py-2"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary">
        Panel Yapım Aşamasında
      </span>
    </motion.div>
  );
}

export default function ComingSoon() {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-12 text-white">
      {/* Background layers */}
      <ParticleCanvas />
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(198,168,124,0.08),transparent_50%)]" />
        <div
          className="absolute h-96 w-96 rounded-full bg-primary/5 blur-[100px] transition-transform duration-700 ease-out"
          style={{
            left: mousePos.x - 192,
            top: mousePos.y - 192,
          }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Top badge */}
        <ConstructionBadge />

        {/* Brand name */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mb-2"
        >
          <h1 className="font-serif text-5xl italic tracking-[0.04em] text-white sm:text-6xl md:text-7xl">
            Archilya Panel
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
          className="mb-12 max-w-lg text-sm leading-relaxed tracking-wide text-white/40 sm:text-base"
        >
          Müşteri paneli ve yapay zeka stüdyosu şu anda geliştirme aşamasında.
          <br className="hidden sm:block" />
          <span className="text-primary/80"> Çok yakında hizmetinizde. </span>
        </motion.p>

        {/* Divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mb-12 h-px w-24 bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        />

        {/* Message cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mb-8 grid max-w-2xl gap-4 sm:grid-cols-2"
        >
          <div className="glass-card flex items-start gap-4 rounded-lg p-5 text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/80">
                Panel Geliştiriliyor
              </h3>
              <p className="text-[11px] leading-relaxed text-white/40">
                AI stüdyosu, proje yönetimi ve kredi sistemi gibi özellikler
                üzerinde çalışıyoruz. Çok yakında erişime açılacak.
              </p>
            </div>
          </div>

          <div className="glass-card flex items-start gap-4 rounded-lg p-5 text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/80">
                Profesyonel Standartta
              </h3>
              <p className="text-[11px] leading-relaxed text-white/40">
                Mimari ofislerin ihtiyaçlarına özel, güvenli ve hızlı bir
                panel deneyimi sunmak için titizlikle çalışıyoruz.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Back to home */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="mb-8"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-sm border border-white/15 bg-white/[0.02] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.28em] text-white transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft className="h-3 w-3" />
            Ana Sayfaya Dön
          </Link>
        </motion.div>

        {/* Thank you message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.6 }}
          className="mb-10 flex items-center gap-2 text-xs text-white/30"
        >
          <Heart className="h-3 w-3 text-primary/60" />
          <span>Destekleriniz için teşekkür ederiz</span>
        </motion.div>

        {/* Bottom branding */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="h-px w-16 bg-white/10" />
          <a
            href="https://nebulanovagames.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-white/20 transition-colors hover:text-primary/60"
          >
            <span>Bir Nebula Nova Games Ürünüdür</span>
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
          <p className="text-[9px] tracking-wider text-white/15">
            © {new Date().getFullYear()} Nebula Nova Games. Tüm hakları saklıdır.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
