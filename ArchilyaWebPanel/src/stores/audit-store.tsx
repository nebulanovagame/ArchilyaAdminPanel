"use client";

import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AuditReport } from "@/lib/types/audit";

type AuditContextValue = {
  auditReport: AuditReport | null;
  isAuditing: boolean;
  canProceed: boolean;
  startAudit: () => void;
  completeAudit: (report: AuditReport) => void;
  resetAudit: () => void;
};

const AUDIT_DRAFT_STORAGE_KEY = "archilya-render-audit-draft";

type PersistedAuditDraft = {
  auditReport: AuditReport | null;
};

const AuditContext = createContext<AuditContextValue | null>(null);

function readPersistedDraft(): PersistedAuditDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const rawDraft = window.localStorage.getItem(AUDIT_DRAFT_STORAGE_KEY);
    return rawDraft ? (JSON.parse(rawDraft) as PersistedAuditDraft) : null;
  } catch {
    return null;
  }
}

export function AuditProvider({ children }: { children: ReactNode }) {
  const [auditReport, setAuditReport] = useState<AuditReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  useEffect(() => {
    const draft = readPersistedDraft();
    if (!draft?.auditReport) return;
    startTransition(() => {
      setAuditReport(draft.auditReport);
    });
  }, []);

  useEffect(() => {
    const draft: PersistedAuditDraft = {
      auditReport,
    };

    try {
      window.localStorage.setItem(AUDIT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Ignore storage errors.
    }
  }, [auditReport]);

  const startAudit = useCallback(() => {
    setIsAuditing(true);
  }, []);

  const completeAudit = useCallback((report: AuditReport) => {
    setAuditReport(report);
    setIsAuditing(false);
  }, []);

  const resetAudit = useCallback(() => {
    setAuditReport(null);
    setIsAuditing(false);

    try {
      window.localStorage.removeItem(AUDIT_DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  const value = useMemo<AuditContextValue>(
    () => ({
      auditReport,
      isAuditing,
      canProceed: auditReport?.canProceed ?? false,
      startAudit,
      completeAudit,
      resetAudit,
    }),
    [auditReport, isAuditing, startAudit, completeAudit, resetAudit],
  );

  return <AuditContext.Provider value={value}>{children}</AuditContext.Provider>;
}

export function useAuditContext() {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error("useAuditContext must be used within an AuditProvider.");
  }
  return context;
}
