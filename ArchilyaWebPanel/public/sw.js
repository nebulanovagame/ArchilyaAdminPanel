const CACHE_NAME = "archilya-panel-v2";
const STATIC_CACHE = "archilya-static-v2";
const IMAGE_CACHE = "archilya-images-v2";

const PRECACHE_ASSETS = [
  "/",
  "/giris",
  "/kayit",
  "/offline",
  "/manifest.json",
  "/icon-192x192.svg",
  "/icon-512x512.svg",
];

// Install: precache shell + static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME && key !== STATIC_CACHE && key !== IMAGE_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Helper: stale-while-revalidate for static assets
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

// Helper: network-first with cache fallback for API/data
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

// Fetch handler with route-based strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 1. Next.js static chunks (_next/static) — stale-while-revalidate
  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
    return;
  }

  // 2. Images — stale-while-revalidate with dedicated image cache
  if (request.destination === "image") {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE));
    return;
  }

  // 3. Navigation requests — cache-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      caches
        .match(request)
        .then((cached) => {
          if (cached) return cached;
          return fetch(request).catch(() => caches.match("/offline"));
        })
        .then((response) => response || caches.match("/")),
    );
    return;
  }

  // 4. API routes — network-first (don't cache by default, but fallback)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request) || new Response(
        JSON.stringify({ error: "Çevrimdışı" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      )),
    );
    return;
  }

  // 5. Everything else — cache-first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        if (request.destination === "document") {
          return caches.match("/offline");
        }
        return new Response("", { status: 503, statusText: "Service Unavailable" });
      });
    }),
  );
});
