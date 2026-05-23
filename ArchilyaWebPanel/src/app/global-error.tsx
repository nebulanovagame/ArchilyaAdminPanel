"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body className="bg-[#0f1115] text-white min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center justify-center px-4 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-8 w-8 text-red-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">
            Kritik bir hata oluştu
          </h2>
          <p className="mb-6 max-w-md text-sm text-gray-400">
            Uygulama yüklenirken beklenmedik bir sorun oluştu. Lütfen sayfayı yenileyin.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-sm bg-primary px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <RefreshCw className="h-4 w-4" />
            Sayfayı Yenile
          </button>
        </div>
      </body>
    </html>
  );
}
