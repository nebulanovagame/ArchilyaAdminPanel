"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "archilya-cookie-consent";

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setShowBanner(false);
  }

  function handleReject() {
    localStorage.setItem(CONSENT_KEY, "rejected");
    setShowBanner(false);
  }

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0d0f13]/95 px-6 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-300 font-sans">
          Bu web sitesi, size daha iyi bir deneyim sunmak için çerezleri
          kullanır. Çerezleri kabul ederek{" "}
          <Link href="/gizlilik" className="text-primary underline">
            Gizlilik Politikamızı
          </Link>{" "}
          ve{" "}
          <Link href="/sartlar" className="text-primary underline">
            Kullanım Koşullarımızı
          </Link>{" "}
          onaylamış olursunuz.
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={handleAccept}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-primary/90"
          >
            Kabul Et
          </button>
          <button
            onClick={handleReject}
            className="rounded border border-white/20 px-4 py-2 text-sm font-medium text-gray-300 transition-colors hover:border-white/40 hover:text-white"
          >
            Reddet
          </button>
        </div>
      </div>
    </div>
  );
}