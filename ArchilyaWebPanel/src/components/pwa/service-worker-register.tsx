"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        // Silent fail — PWA is best-effort
      });
  }, []);

  return null;
}
