"use client";

import { useState, useCallback } from "react";

import { useTheme } from "@/components/providers/theme-provider";

type LogoVariant = "sidebar" | "header" | "auth";

type LogoProps = {
  variant?: LogoVariant;
  collapsed?: boolean;
};

function isValidLogoUrl(url: string | undefined): url is string {
  return typeof url === "string" && url.length > 0 && url.startsWith("http");
}

export function Logo({ variant = "sidebar", collapsed = false }: LogoProps) {
  const { branding } = useTheme();
  const [imageError, setImageError] = useState(false);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const { brandName, tagline, logoUrl } = branding;

  // When collapsed, show only first letter
  if (collapsed) {
    const firstLetter = brandName.charAt(0).toUpperCase();

    return (
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
        <span className="font-serif italic text-white text-xl">{firstLetter}</span>
      </div>
    );
  }

  // Render image logo if URL exists and is valid, and hasn't errored
  if (isValidLogoUrl(logoUrl) && !imageError) {
    const sizeClasses = {
      sidebar: "h-10 w-auto",
      header: "h-6 w-auto",
      auth: "h-16 w-auto",
    };

    return (
      <img
        src={logoUrl}
        alt={brandName}
        className={sizeClasses[variant]}
        onError={handleImageError}
      />
    );
  }

  // Render text logo
  const containerClasses = {
    sidebar: "flex flex-col",
    header: "flex items-center",
    auth: "flex flex-col items-center text-center",
  };

  const brandNameClasses = {
    sidebar: "font-serif italic text-white text-2xl leading-tight",
    header: "font-serif italic text-white text-lg leading-tight",
    auth: "font-serif italic text-white text-4xl leading-tight",
  };

  const taglineClasses = {
    sidebar: "text-[7px] uppercase tracking-[0.2em] text-primary mt-0.5",
    header: "hidden",
    auth: "text-[7px] uppercase tracking-[0.2em] text-primary mt-2",
  };

  const showTagline = tagline && tagline.length > 0;

  return (
    <div className={containerClasses[variant]}>
      <span className={brandNameClasses[variant]}>{brandName}</span>
      {showTagline && <span className={taglineClasses[variant]}>{tagline}</span>}
    </div>
  );
}
