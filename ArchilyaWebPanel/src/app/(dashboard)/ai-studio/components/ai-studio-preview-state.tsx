/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut, Maximize2, Minimize2, ImageOff } from "lucide-react";
import { scaleIn } from "../lib/animation-variants";
import { useTranslations } from "next-intl";

interface AiStudioPreviewStateProps {
  refImagePreview: string;
  onClear: () => void;
}

type ZoomLevel = "fit" | 1 | 1.5 | 2;

const ZOOM_LEVELS: ZoomLevel[] = ["fit", 1, 1.5, 2];

function getZoomLabel(level: ZoomLevel, fitLabel: string): string {
  if (level === "fit") return fitLabel;
  return `${level}×`;
}

function getNextZoom(level: ZoomLevel): ZoomLevel {
  const idx = ZOOM_LEVELS.indexOf(level);
  return ZOOM_LEVELS[(idx + 1) % ZOOM_LEVELS.length];
}

function getPrevZoom(level: ZoomLevel): ZoomLevel {
  const idx = ZOOM_LEVELS.indexOf(level);
  return ZOOM_LEVELS[(idx - 1 + ZOOM_LEVELS.length) % ZOOM_LEVELS.length];
}

export default function AiStudioPreviewState({
  refImagePreview,
  onClear,
}: AiStudioPreviewStateProps) {
  const t = useTranslations("dashboard.aiStudio");
  const [zoom, setZoom] = useState<ZoomLevel>("fit");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Reset image error state when preview changes
  useEffect(() => {
    const id = setTimeout(() => setImgError(false), 0);
    return () => clearTimeout(id);
  }, [refImagePreview]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Fullscreen API not available or denied
    }
  }, []);

  const zoomScale = zoom === "fit" ? undefined : zoom;

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0 }}
      className="relative overflow-hidden rounded-sm border border-white/[0.08] bg-black/30"
    >
      {/* Image with zoom support */}
      <div
        ref={containerRef}
        className="relative w-full flex items-center justify-center overflow-auto"
        style={{ minHeight: "320px", maxHeight: "560px" }}
      >
        {imgError ? (
          <div className="flex items-center justify-center gap-2 text-red-400/70 text-[10px] p-8">
            <ImageOff className="w-5 h-5" />
            {t("imageLoadFailed")}
          </div>
        ) : (
          <img
            src={refImagePreview}
            alt={t("referenceAlt")}
            className="transition-transform duration-200"
            onError={() => setImgError(true)}
            style={{
              maxWidth: zoom === "fit" ? "100%" : "none",
              maxHeight: zoom === "fit" ? "480px" : "none",
              transform:
                zoomScale ? `scale(${zoomScale})` : "none",
              transformOrigin: "center center",
            }}
          />
        )}
      </div>

      {/* Top-left badge */}
      <div className="absolute top-3 left-3 rounded-sm border border-white/10 bg-black/70 px-2 py-1 text-[9px] uppercase tracking-widest text-gray-200">
        {t("referenceReady")}
      </div>

      {/* Top-right actions */}
      <div className="absolute top-3 right-3 flex gap-1.5">
        {/* Zoom out */}
        <button
          onClick={() => setZoom(getPrevZoom(zoom))}
          className="w-7 h-7 rounded-sm border border-white/10 bg-black/70 flex items-center justify-center text-gray-300 hover:text-white hover:border-white/20 transition-colors active:scale-[0.92] focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none"
          title={getZoomLabel(getPrevZoom(zoom), t("zoomFit"))}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        {/* Zoom indicator */}
        <div className="h-7 px-2 rounded-sm border border-white/10 bg-black/70 flex items-center text-[9px] font-bold uppercase tracking-wider text-gray-300">
          {getZoomLabel(zoom, t("zoomFit"))}
        </div>
        {/* Zoom in */}
        <button
          onClick={() => setZoom(getNextZoom(zoom))}
          className="w-7 h-7 rounded-sm border border-white/10 bg-black/70 flex items-center justify-center text-gray-300 hover:text-white hover:border-white/20 transition-colors active:scale-[0.92] focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none"
          title={getZoomLabel(getNextZoom(zoom), t("zoomFit"))}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        {/* Fullscreen toggle */}
        <button
          onClick={toggleFullscreen}
          className="w-7 h-7 rounded-sm border border-white/10 bg-black/70 flex items-center justify-center text-gray-300 hover:text-white hover:border-white/20 transition-colors active:scale-[0.92] focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:outline-none"
        >
          {isFullscreen ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Bottom-right clear button */}
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          onClick={onClear}
          className="rounded-sm border border-white/10 bg-black/70 px-3 py-1.5 text-[9px] uppercase tracking-widest text-gray-300 hover:text-white transition-colors"
        >
          {t("changeFile")}
        </button>
      </div>
    </motion.div>
  );
}
