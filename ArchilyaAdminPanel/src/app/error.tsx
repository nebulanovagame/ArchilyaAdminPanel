"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Panel Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0f1115] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-red-400 text-2xl font-serif">!</span>
        </div>
        <h1 className="font-serif text-3xl text-white italic mb-3">
          Bir Hata Oluştu
        </h1>
        <p className="text-sm font-sans text-gray-500 mb-2">
          Beklenmeyen bir hata ile karşılaşıldı.
        </p>
        <p className="text-[10px] font-sans text-gray-700 mb-8 font-mono">
          {error.message || "Bilinmeyen hata"}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-sm bg-primary px-6 py-3 font-sans text-xs font-bold uppercase tracking-widest text-black transition-all duration-300 hover:bg-white"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
