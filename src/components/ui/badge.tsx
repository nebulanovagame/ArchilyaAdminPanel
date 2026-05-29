import type { HTMLAttributes } from "react";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary border-primary/20",
  success: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  warning: "bg-amber-400/10 text-amber-400 border-amber-400/20",
  danger: "bg-red-400/10 text-red-400 border-red-400/20",
  info: "bg-blue-400/10 text-blue-400 border-blue-400/20",
  neutral: "bg-gray-400/10 text-gray-400 border-gray-400/20",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center text-[9px] font-bold uppercase tracking-wider
        px-2 py-0.5 rounded-full border
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}
