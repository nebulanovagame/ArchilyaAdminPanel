import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="border border-dashed border-white/10 rounded-sm py-16 text-center">
      <Icon className="w-12 h-12 text-gray-700 mx-auto mb-4" />
      <p className="text-gray-500 font-sans text-sm mb-1">{title}</p>
      {description && (
        <p className="text-[10px] font-sans text-gray-700 uppercase tracking-widest mb-4">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
