"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-[10px] font-sans uppercase tracking-[0.2em] text-gray-500">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`
            w-full rounded-sm border bg-white/5 px-3 py-2.5 text-sm text-white
            placeholder:text-gray-700 focus:outline-none transition-colors duration-300
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? "border-red-500/40 focus:border-red-500/60" : "border-white/10 focus:border-primary/40"}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p className="text-[10px] font-sans text-red-400">{error}</p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
