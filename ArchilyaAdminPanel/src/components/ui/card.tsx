import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover, className = "", children, ...props }: CardProps) {
  return (
    <div
      className={`
        glass-card rounded-sm p-5
        ${hover ? "hover:border-primary/25 transition-all duration-300" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={`font-serif text-lg text-white italic ${className}`}>{children}</h3>;
}

export function CardValue({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <p className={`font-sans text-2xl font-bold text-white tracking-tight ${className}`}>{children}</p>;
}

export function CardDescription({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <p className={`text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500 mt-1 ${className}`}>{children}</p>;
}
