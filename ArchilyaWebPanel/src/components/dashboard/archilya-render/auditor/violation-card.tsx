"use client";

import { useTranslations } from "next-intl";

import type { AuditViolation } from "@/lib/types/audit";

type ViolationCardProps = {
  violation: AuditViolation;
};

export default function ViolationCard({ violation }: ViolationCardProps) {
  const t = useTranslations("dashboard.archilyaRender.auditRules");
  const dashboardT = useTranslations("dashboard.archilyaRender");
  const isCritical = violation.severity === "CRITICAL";
  const severityColor = isCritical ? "#FF4757" : "#FFA502";
  const message = t(`${violation.code}.message`);
  const fixGuidance = t(`${violation.code}.fixGuidance`);

  return (
    <div
      className="rounded-sm border bg-[#0d0f13] p-4"
      style={{ borderColor: `${severityColor}55` }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-sm border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ borderColor: severityColor, color: severityColor }}
        >
          {violation.code}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ color: severityColor }}
        >
          {violation.severity}
        </span>
        {violation.targetLabel && (
          <span className="text-xs font-sans text-gray-500">{violation.targetLabel}</span>
        )}
      </div>

      <p className="mt-3 text-sm font-sans text-white">{message}</p>
      <div className="mt-3 border border-white/10 bg-black/20 p-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
          {dashboardT("auditor.solutionGuide")}
        </p>
        <p className="mt-1 text-xs font-sans leading-relaxed text-gray-300">
          {fixGuidance}
        </p>
      </div>
    </div>
  );
}
