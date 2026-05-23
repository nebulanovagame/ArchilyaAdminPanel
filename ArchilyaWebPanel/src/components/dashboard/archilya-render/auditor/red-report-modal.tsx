"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AuditReport } from "@/lib/types/audit";
import ViolationCard from "@/components/dashboard/archilya-render/auditor/violation-card";

type RedReportModalProps = {
  report: AuditReport;
  onBack: () => void;
};

export default function RedReportModal({ report, onBack }: RedReportModalProps) {
  const t = useTranslations("dashboard.archilyaRender");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-3xl overflow-hidden rounded-sm border border-white/10 bg-[#0a0c0f] shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">
              {t("auditor.redLineAuditor")}
            </p>
            <h2 className="mt-1 text-2xl font-serif italic text-white">{t("auditor.auditReport")}</h2>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wider">
              <span className="rounded-sm border border-[#FF4757]/40 bg-[#FF4757]/10 px-3 py-1 text-[#FF4757]">
                {report.criticalCount} Critical
              </span>
              <span className="rounded-sm border border-[#FFA502]/40 bg-[#FFA502]/10 px-3 py-1 text-[#FFA502]">
                {report.warningCount} Warning
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-white/10 text-gray-500 transition-colors hover:border-white/20 hover:text-white"
            aria-label={t("auditor.closeReport")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto p-5">
          {report.violations.map((violation, index) => (
            <ViolationCard
              key={`${violation.code}-${violation.targetLabel ?? "global"}-${index}`}
              violation={violation}
            />
          ))}
        </div>

        <div className="border-t border-white/10 p-5">
          <button
            type="button"
            onClick={onBack}
            className="w-full rounded-sm border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-black"
          >
            {t("auditor.backAndFix")}
          </button>
        </div>
      </div>
    </div>
  );
}
