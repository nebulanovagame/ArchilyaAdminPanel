"use client";

import { useEffect, useState } from "react";
import { Sparkles, Building2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { useCredits, formatCredits } from "@/hooks/use-credits";
import { useWorkspace } from "@/hooks/use-workspace";

export default function CreditPills() {
  const t = useTranslations();
  const { credits, loading: creditsLoading } = useCredits();
  const { activeWorkspace, loading: workspaceLoading } = useWorkspace();
  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setForceReady(true);
    }, 3000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const showWorkspacePill = Boolean(activeWorkspace);
  const isLoading = (creditsLoading || workspaceLoading) && !forceReady;

  return (
    <>
      {/* Personal credit pill — compact on mobile, full on desktop */}
      <div className="flex items-center gap-1.5 sm:gap-2 bg-primary/10 border border-primary/20 px-2 sm:px-3 py-1.5 rounded-sm">
        <Sparkles className="w-3 h-3 text-primary shrink-0" />
        <span className="text-xs font-sans font-bold text-primary tracking-wider">
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            `${formatCredits(credits)} ${t("common.credit")}`
          )}
        </span>
        <span className="hidden sm:inline text-[9px] font-sans text-gray-600 uppercase tracking-wider">
          {t("dashboard.header.personalCredits")}
        </span>
      </div>

      {/* Shared/Workspace credit pill — compact on mobile, full on desktop */}
      {showWorkspacePill && (
        <div className="flex items-center gap-1.5 sm:gap-2 bg-amber-400/10 border border-amber-400/20 px-2 sm:px-3 py-1.5 rounded-sm">
          <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="text-xs font-sans font-bold text-amber-400 tracking-wider">
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              `${formatCredits(activeWorkspace?.poolCredits)} ${t("common.credit")}`
            )}
          </span>
          <span className="hidden sm:inline text-[9px] font-sans text-gray-600 uppercase tracking-wider">
            {t("dashboard.header.sharedCredits")}
          </span>
        </div>
      )}
    </>
  );
}
