import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { Badge } from "./badge";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

export function Table({ className = "", children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full border-collapse text-sm font-sans ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ className = "", children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`border-b border-white/5 ${className}`} {...props}>{children}</thead>;
}

export function TableBody({ className = "", children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props}>{children}</tbody>;
}

export function TableRow({ className = "", children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`
        border-b border-white/5 last:border-0
        hover:bg-white/[0.02] transition-colors
        ${className}
      `}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({ className = "", children, ...props }: ThHTMLAttributes<HTMLTableHeaderCellElement>) {
  return (
    <th
      className={`
        px-4 py-3 text-left text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-gray-500
        ${className}
      `}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ className = "", children, ...props }: TdHTMLAttributes<HTMLTableDataCellElement>) {
  return (
    <td className={`px-4 py-3 text-sm text-gray-300 ${className}`} {...props}>
      {children}
    </td>
  );
}

export function TableStatus({ status }: { status: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    active: "success",
    online: "success",
    healthy: "success",
    completed: "success",
    yes: "success",
    true: "success",
    disabled: "neutral",
    archived: "neutral",
    offline: "neutral",
    trialing: "neutral",
    suspended: "warning",
    pending: "warning",
    queued: "warning",
    processing: "info",
    failed: "danger",
    canceled: "danger",
    revoked: "danger",
    expired: "danger",
    past_due: "danger",
    refunded: "warning",
    maintenance: "warning",
    degraded: "warning",
    down: "danger",
  };

  return <Badge variant={variantMap[status.toLowerCase()] || "default"}>{status}</Badge>;
}
