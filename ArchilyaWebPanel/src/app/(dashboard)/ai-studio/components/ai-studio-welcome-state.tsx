"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Image, FileEdit, Palette, Sparkles, SplitSquareHorizontal } from "lucide-react";
import { fadeInUp, staggerContainer } from "../lib/animation-variants";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { ToolConfig } from "../types";

/** Returns true if screen width matches the xl breakpoint (1280px, desktop tool rail shown).
 *  Initializes to false to match the server (no window object), then corrects on mount. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1280);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isDesktop;
}

interface AiStudioWelcomeStateProps {
  onSelectTool: (tool: ToolConfig) => void;
  tools: readonly ToolConfig[];
  planLabel?: string;
  remainingCredits?: number | null;
  isFirstVisit?: boolean;
  onDismissFirstVisit?: () => void;
}

export default function AiStudioWelcomeState({
  onSelectTool,
  tools,
  planLabel,
  remainingCredits,
  isFirstVisit,
  onDismissFirstVisit,
}: AiStudioWelcomeStateProps) {
  const t = useTranslations("dashboard.aiStudio");
  const isDesktop = useIsDesktop();

  const suggestionCards = [
    {
      tool: tools.find((t) => t.id === "img2img"),
      icon: Image,
      labelKey: "welcomeCardImg2img",
      subtitleKey: "welcomeCardImg2imgDesc",
      featured: false,
    },
    {
      tool: tools.find((t) => t.id === "sceneedit"),
      icon: FileEdit,
      labelKey: "welcomeCardSceneedit",
      subtitleKey: "welcomeCardSceneeditDesc",
      featured: true,
    },
    {
      tool: tools.find((t) => t.id === "plancolor"),
      icon: Palette,
      labelKey: "welcomeCardPlancolor",
      subtitleKey: "welcomeCardPlancolorDesc",
      featured: false,
    },
    {
      tool: tools.find((t) => t.id === "multi-angle"),
      icon: SplitSquareHorizontal,
      labelKey: "welcomeCardMultiangle",
      subtitleKey: "welcomeCardMultiangleDesc",
      featured: false,
    },
  ];

  const onboardingSteps = [
    { step: "01", titleKey: "onboardingStep1", descKey: "onboardingStep1Desc" },
    { step: "02", titleKey: "onboardingStep2", descKey: "onboardingStep2Desc" },
    { step: "03", titleKey: "onboardingStep3", descKey: "onboardingStep3Desc" },
  ] as const;

  return (
    <div className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden p-8 sm:p-10">
      {isFirstVisit && (
        <div className="relative z-20 mb-6 flex items-center justify-between gap-4 rounded-sm border border-primary/15 bg-primary/5 px-4 py-3">
          <p className="text-[10px] text-gray-300 font-sans leading-relaxed">
            {isDesktop
              ? t("firstVisitDesktop")
              : t("firstVisitMobile")}
          </p>
          <button
            onClick={onDismissFirstVisit}
            className="flex-shrink-0 rounded-sm border border-white/[0.08] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-gray-500 hover:text-white transition-colors"
          >
            Tamam
          </button>
        </div>
      )}

      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(198, 168, 124, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(198, 168, 124, 0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.04),transparent_36%)]" />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-sm border border-amber-300/15 bg-amber-400/8 shadow-[0_0_40px_rgba(245,158,11,0.08)]">
          <Sparkles className="h-4 w-4 text-amber-300" />
        </div>

        <div className="space-y-3">
          <p className="text-[9px] uppercase tracking-wider font-bold text-gray-500 font-sans">
            {t("eyebrow")}
          </p>
          <h2 className="text-2xl font-serif italic text-white sm:text-[28px]">
            {t("welcomeQuestion")}
          </h2>
          <p className="mx-auto max-w-xl text-sm font-sans leading-relaxed text-gray-400">
            {t("welcomeHelp")}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-[8px] uppercase tracking-[0.2em] text-gray-600/60 font-sans">
          <span className="rounded-sm border border-white/[0.06] px-2 py-1">Sketchup</span>
          <span>→</span>
          <span className="rounded-sm border border-primary/10 px-2 py-1 text-primary/70">AI Render</span>
          <span>→</span>
          <span className="rounded-sm border border-white/[0.06] px-2 py-1">Revize</span>
          <span>→</span>
          <span className="rounded-sm border border-white/[0.06] px-2 py-1">Analiz</span>
          <span>→</span>
          <span className="rounded-sm border border-white/[0.06] px-2 py-1">Sunum</span>
        </div>

        <div className="w-full max-w-2xl border-t border-white/[0.04]" />

        <motion.div
          className="relative w-full max-w-4xl"
          variants={fadeInUp}
          initial="hidden"
          animate="visible"
        >
          <div className="pointer-events-none absolute top-7 left-[16.66%] right-[16.66%] hidden items-center justify-between px-8 text-[10px] text-gray-600 sm:flex">
            <span>· · ·</span>
            <span>→</span>
            <span>· · ·</span>
            <span>→</span>
            <span>· · ·</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {onboardingSteps.map((item, index) => (
              <div key={item.step} className="relative">
                <div className="rounded-sm border border-white/[0.04] bg-white/[0.015] px-4 py-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/[0.05] bg-white/[0.02]">
                      <span className="text-[10px] font-semibold tracking-[0.16em] text-gray-500">
                        {item.step}
                      </span>
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[12px] font-semibold leading-tight text-gray-400">
                        {t(item.titleKey)}
                      </p>
                      <p className="mt-1.5 text-[10px] leading-relaxed text-gray-600">
                        {t(item.descKey)}
                      </p>
                    </div>
                  </div>
                </div>

                {index < onboardingSteps.length - 1 && (
                  <div className="flex items-center justify-center py-1 text-[10px] text-gray-600 sm:hidden">
                    <span>· · ·</span>
                    <span className="mx-1">↓</span>
                    <span>· · ·</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="w-full max-w-2xl border-t border-white/[0.04]" />

        <motion.div
          className="grid w-full grid-cols-1 gap-3.5 sm:grid-cols-2"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {suggestionCards.map((card, index) => {
            if (!card.tool) return null;
            const Icon = card.icon;
            return (
              <motion.button
                key={card.tool.id}
                variants={fadeInUp}
                custom={index}
                onClick={() => onSelectTool(card.tool!)}
                className={`group relative flex h-full items-start gap-4 rounded-sm border p-5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 ${
                  card.featured
                    ? "border-amber-300/25 bg-amber-400/8 hover:-translate-y-0.5 hover:border-amber-300/45 hover:bg-amber-400/10 hover:shadow-[0_16px_40px_rgba(245,158,11,0.08)]"
                    : "border-white/[0.06] bg-white/[0.025] hover:-translate-y-0.5 hover:border-amber-300/25 hover:bg-white/[0.035] hover:shadow-[0_14px_34px_rgba(0,0,0,0.22)]"
                }`}
              >
                {card.featured && (
                  <div className="absolute -top-2.5 left-4 rounded-[2px] border border-amber-300/30 bg-amber-400/12 px-2 py-0.5 text-[7px] font-bold uppercase tracking-[0.15em] text-amber-300">
                    {t("featuredBadge")}
                  </div>
                )}
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm border transition-colors ${
                  card.featured
                    ? "border-amber-300/20 bg-amber-400/10 group-hover:bg-amber-400/15"
                    : "border-amber-300/12 bg-amber-400/8 group-hover:bg-amber-400/10"
                }`}>
                  <Icon className={`h-5 w-5 transition-colors ${
                    card.featured
                      ? "text-amber-300 group-hover:text-amber-200"
                      : "text-amber-300/75 group-hover:text-amber-300"
                   }`} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[13px] font-sans font-semibold text-white/90 transition-colors leading-snug group-hover:text-white">
                    {t(card.labelKey)}
                  </p>
                  <p className="mt-2 text-[10px] font-sans text-gray-400 transition-colors leading-relaxed group-hover:text-gray-300">
                    {t(card.subtitleKey)}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>

        <div className="mt-6 w-full border-t border-white/[0.04] pt-4 flex items-center justify-between">
          {planLabel && remainingCredits != null && (
            <span className="text-[10px] text-gray-600 font-sans">
              {planLabel} · {remainingCredits.toLocaleString("tr-TR")} işlem hakkı
            </span>
          )}
          <Link
            href="/abonelik"
            className="text-[10px] text-gray-600 hover:text-primary transition-colors font-sans"
          >
            Fiyatlandırmayı görüntüle →
          </Link>
        </div>
      </div>
    </div>
  );
}
