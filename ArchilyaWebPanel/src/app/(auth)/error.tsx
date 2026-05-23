"use client";

import { useEffect } from "react";

export default function AuthErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[AuthErrorBoundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="font-serif text-3xl text-white italic mb-4">
          Bir Sorun Oluştu
        </h1>
        <p className="text-sm text-gray-400 font-sans mb-8">
          Sayfa yüklenirken beklenmedik bir hata oluştu. Lütfen tekrar deneyin.
        </p>
        <button
          onClick={reset}
          className="bg-primary text-black font-sans font-bold text-sm uppercase tracking-widest py-3 px-8 rounded-sm hover:bg-white transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
