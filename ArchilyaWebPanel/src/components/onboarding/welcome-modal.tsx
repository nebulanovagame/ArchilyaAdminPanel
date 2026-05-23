"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Sparkles,
  Users,
  CreditCard,
  X,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <Sparkles className="w-6 h-6 text-primary" />,
    title: "Archilya AI'ye Hoş Geldiniz",
    description:
      "Mimari projelerinizi yapay zeka ile güçlendirin. Görsel analiz, stil dönüşümü, render iyileştirme ve daha fazlasını keşfedin.",
  },
  {
    icon: <Users className="w-6 h-6 text-emerald-400" />,
    title: "Ekibinizi Birleştirin",
    description:
      "Çalışma alanınızı oluşturun, ekip üyelerini davet edin ve projelerinizi birlikte yönetin. Roller ve yetkiler tam sizin kontrolünüzde.",
  },
  {
    icon: <CreditCard className="w-6 h-6 text-amber-400" />,
    title: "Aboneliğinizi Yönetin",
    description:
      "İhtiyaçlarınıza uygun planı seçin, kredi havuzunuzu kontrol edin ve ekibinizin potansiyelini en üst düzeye çıkarın.",
  },
];

interface WelcomeModalProps {
  open: boolean;
  onFinish: () => void;
}

export default function WelcomeModal({ open, onFinish }: WelcomeModalProps) {
  const [step, setStep] = useState(0);
  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handleNext() {
    if (isLast) {
      onFinish();
      setStep(0);
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleSkip() {
    onFinish();
    setStep(0);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            aria-describedby="welcome-desc"
            className="w-full max-w-lg mx-4 bg-[#0d0f13] border border-white/10 rounded-sm overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <h2 id="welcome-title" className="text-sm font-serif text-white italic">Hoş Geldiniz</h2>
              </div>
              <button
                onClick={handleSkip}
                aria-label="Kapat"
                className="w-7 h-7 flex items-center justify-center text-gray-600 hover:text-gray-300 transition-colors rounded-sm hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-1.5 px-6 pt-5">
              {STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    index <= step ? "bg-primary" : "bg-white/10"
                  }`}
                />
              ))}
            </div>

            {/* Content */}
            <div className="px-6 py-8 text-center">
              <div className="w-14 h-14 mx-auto mb-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                {currentStep.icon}
              </div>
              <h3 id="welcome-desc" className="text-lg font-serif text-white italic mb-3">
                {currentStep.title}
              </h3>
              <p className="text-sm text-gray-400 font-sans leading-relaxed max-w-sm mx-auto">
                {currentStep.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-6 pb-6">
              <button
                onClick={handleSkip}
                className="text-xs text-gray-500 hover:text-gray-300 font-sans uppercase tracking-widest transition-colors"
              >
                Atla
              </button>
              <button
                onClick={handleNext}
                className="flex items-center gap-2 bg-primary text-black text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-sm hover:opacity-90 transition-opacity"
              >
                {isLast ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Başla
                  </>
                ) : (
                  <>
                    İleri <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
