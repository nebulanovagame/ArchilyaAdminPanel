"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

import { AUDIT_RULE_COUNT } from "@/lib/constants/audit-rules";

type AuditProgressRingProps = {
  isAuditing: boolean;
};

export default function AuditProgressRing({ isAuditing }: AuditProgressRingProps) {
  const t = useTranslations("dashboard.archilyaRender");
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-3 rounded-sm border border-[#2ED573]/30 bg-[#2ED573]/5 px-4 py-3 text-[#2ED573]">
      <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="4"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="4"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: isAuditing ? 0 : circumference }}
          transition={{ duration: 1.2, ease: "linear" }}
        />
      </svg>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em]">{t("auditor.auditRunning")}</p>
        <p className="mt-1 text-[11px] font-sans text-gray-400">
          {AUDIT_RULE_COUNT} {t("auditor.rulesChecking")}
        </p>
      </div>
    </div>
  );
}
