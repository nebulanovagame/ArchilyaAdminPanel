import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

export default function Preloader({ onComplete }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      className="fixed inset-0 z-[60] bg-[#0f1115] flex flex-col items-center justify-center overflow-hidden"
    >
      <div className="relative">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="font-serif text-6xl md:text-8xl text-white italic mb-8 tracking-tighter"
        >
          Archilya
        </motion.div>

        <div className="w-64 h-[1px] bg-white/10 relative overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex justify-between font-mono text-[10px] text-primary uppercase tracking-widest">
          <span>System Initializing</span>
          <span>{progress}%</span>
        </div>
      </div>

      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
      />
    </motion.div>
  );
}
