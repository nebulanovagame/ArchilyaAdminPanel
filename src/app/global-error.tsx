"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "admin-global-error" },
    });
  }, [error]);

  return (
    <html lang="tr">
      <body className="min-h-screen bg-[#0f1115] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
            <span className="text-red-400 text-2xl font-serif">!</span>
          </div>
          <h1 className="font-serif text-3xl text-white italic mb-3">
            Kritik Hata
          </h1>
          <p className="text-sm font-sans text-gray-500 mb-8">
            Uygulama yüklenirken beklenmedik bir sorun oluştu. Lütfen sayfayı yenileyin.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-sm bg-[#c6a87c] px-6 py-3 font-sans text-xs font-bold uppercase tracking-widest text-black transition-all duration-300 hover:bg-white"
          >
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  );
}
