import type { AuditRule } from "@/lib/types/audit";

export const AUDIT_RULES = [
  { code: "INP-001", severity: "CRITICAL" },
  { code: "INP-002", severity: "WARNING" },
  { code: "INP-003", severity: "WARNING" },
  { code: "INP-004", severity: "CRITICAL" },
  { code: "SCN-001", severity: "CRITICAL" },
  { code: "SCN-002", severity: "WARNING" },
  { code: "SCN-003", severity: "WARNING" },
  { code: "SCN-004", severity: "WARNING" },
  { code: "MAT-001", severity: "WARNING" },
  { code: "MAT-002", severity: "WARNING" },
  { code: "MAT-003", severity: "WARNING" },
  { code: "MAT-004", severity: "WARNING" },
  { code: "VIS-001", severity: "CRITICAL" },
  { code: "VIS-002", severity: "CRITICAL" },
  { code: "VIS-003", severity: "WARNING" },
  { code: "VIS-004", severity: "WARNING" },
  { code: "ATM-001", severity: "WARNING" },
  { code: "ATM-002", severity: "WARNING" },
  { code: "ATM-003", severity: "WARNING" },
] as const satisfies readonly AuditRule[];

export const AUDIT_RULE_COUNT = AUDIT_RULES.length;
