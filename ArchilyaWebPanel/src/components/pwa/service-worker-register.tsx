"use client";

import { useEffect } from "react";

const CACHE_PREFIX = "archilya-";

async function clearDevelopmentServiceWorkers() {
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (!("caches" in window)) return;

  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith(CACHE_PREFIX))
      .map((cacheName) => caches.delete(cacheName)),
  );
}

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      clearDevelopmentServiceWorkers().catch((error) => {
        console.warn("Development service worker cleanup failed", error);
      });
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .catch(() => {
        // Silent fail — PWA is best-effort
      });
  }, []);

  return null;
}
