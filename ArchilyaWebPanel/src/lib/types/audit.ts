export type RuleSeverity = "CRITICAL" | "WARNING";

export interface AuditRule {
  code: string;
  severity: RuleSeverity;
}

export interface AuditViolation extends AuditRule {
  targetLabel?: string;
}

export interface AuditReport {
  violations: AuditViolation[];
  criticalCount: number;
  warningCount: number;
  canProceed: boolean;
  checkedRuleCount: number;
  createdAt: number;
}
