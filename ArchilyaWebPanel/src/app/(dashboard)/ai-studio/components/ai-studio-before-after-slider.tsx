/* eslint-disable @next/next/no-img-element */
"use client";

import Image from "next/image";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ImageOff } from "lucide-react";

interface AiStudioBeforeAfterSliderProps {
  refImagePreview: string;
  resultImage: { src: string; mimeType: string } | null;
  compareSplit: number;
  onCompareSplitChange: (value: number) => void;
}

function isExternalUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

export default function AiStudioBeforeAfterSlider({
  refImagePreview,
  resultImage,
  compareSplit,
  onCompareSplitChange,
}: AiStudioBeforeAfterSliderProps) {
  const t = useTranslations("dashboard.aiStudio");
  const [imgError, setImgError] = useState(false);
  const [refImgError, setRefImgError] = useState(false);

  if (!resultImage) {
    return null;
  }

  return (
    <div className="border-b border-white/5 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <p className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">
            {t("beforeAfter")}
          </p>
        </div>
        <span className="text-[9px] text-gray-600 font-mono">
          {t("resultPercent", { percent: compareSplit })}
        </span>
      </div>
      <div className="relative h-[260px] w-full overflow-hidden rounded-sm border border-white/10 bg-gradient-to-b from-black/40 to-black/30 md:h-[340px]">
        {/* Original */}
        {refImgError ? (
          <div className="flex h-full w-full items-center justify-center text-red-400/70 text-[10px] gap-2">
            <ImageOff className="w-5 h-5" /> {t("imageLoadFailed")}
          </div>
        ) : (
          <img
            src={refImagePreview}
            alt={t("originalAlt")}
            className="h-full w-full object-contain"
            onError={() => setRefImgError(true)}
          />
        )}
        {/* Result overlay */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - compareSplit}% 0 0)` }}
        >
          {imgError ? (
            <div className="flex h-full w-full items-center justify-center text-red-400 text-[10px]">
              <ImageOff className="w-5 h-5 mr-2" /> {t("imageLoadFailed")}
            </div>
          ) : isExternalUrl(resultImage.src) ? (
            <Image
              src={resultImage.src}
              alt={t("resultAlt")}
              fill
              className="object-contain"
              unoptimized
              onError={() => setImgError(true)}
            />
          ) : (
            <img
              src={resultImage.src}
              alt={t("resultAlt")}
              className="h-full w-full object-contain"
              onError={() => setImgError(true)}
            />
          )}
        </div>
        {/* Split handle */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-white/80 shadow-lg"
          style={{ left: `${compareSplit}%` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-8 rounded-sm bg-white/90 border border-white/20 flex items-center justify-center shadow-xl">
            <svg className="w-3 h-3 text-gray-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </div>
        </div>
        {/* Labels */}
        <div className="absolute bottom-3 left-3 px-2 py-1 rounded-[2px] bg-black/60 border border-white/10 text-[8px] uppercase tracking-widest text-gray-300">
          {t("originalAlt")}
        </div>
        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-[2px] bg-black/60 border border-white/10 text-[8px] uppercase tracking-widest text-primary/80">
          {t("resultAlt")}
        </div>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={compareSplit}
        onChange={(event) => onCompareSplitChange(Number(event.target.value))}
        className="w-full mt-3 accent-primary h-1.5 rounded-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/30 [&::-webkit-slider-thumb]:shadow-lg"
      />
    </div>
  );
}
