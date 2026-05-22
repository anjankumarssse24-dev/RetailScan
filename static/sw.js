/**
 * RetailScan AI — Service Worker (sw.js)
 * 
 * Strategy:
 *  • App Shell → Cache-first (CSS, JS, fonts, icons)
 *  • API calls → Network-first with cache fallback
 *  • Images    → Stale-while-revalidate
 *  • Offline fallback page served when network is unavailable
 */

"use strict";

const CACHE_VERSION  = "v1.0.0";
const SHELL_CACHE    = `retailscan-shell-${CACHE_VERSION}`;
const API_CACHE      = `retailscan-api-${CACHE_VERSION}`;
const IMG_CACHE      = `retailscan-images-${CACHE_VERSION}`;

// ── App shell: resources cached on install ───────────────────────
const SHELL_ASSETS = [
  "/",
  "/cart",
  "/history",
  "/payment",
  "/login",
  "/offline",
  "/static/css/style.css",
  "/static/css/components.css",
  "/static/js/main.js",
  "/static/js/auth.js",
  "/static/js/cart.js",
  "/static/js/payment.js",
  "/static/js/history.js",
  "/static/js/nav-user.js",
  "/static/manifest.json",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  // CDN fonts via cache
  "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
];

// ── Install: pre-cache app shell ─────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS.map(url => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(err => {
        // Log but don't fail install if some CDN assets are unreachable
        console.warn("[SW] Shell pre-cache partial failure:", err);
        return self.skipWaiting();
      })
  );
});

// ── Activate: clean old caches ───────────────────────────────────
self.addEventListener("activate", event => {
  const validCaches = [SHELL_CACHE, API_CACHE, IMG_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => !validCaches.includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ──────────────────────────────────────
self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, cross-origin (except fonts/CDN), and browser-extension requests
  if (request.method !== "GET") return;
  if (!url.origin.startsWith("http")) return;

  // ── 1. API requests → Network-first ────────────────────────
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/api/")) {
    event.respondWith(networkFirstWithCacheFallback(request, API_CACHE));
    return;
  }

  // ── 2. Images (captured) → Stale-while-revalidate ──────────
  if (url.pathname.startsWith("/captured_images/") ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    event.respondWith(staleWhileRevalidate(request, IMG_CACHE));
    return;
  }

  // ── 3. App shell + static assets → Cache-first ─────────────
  event.respondWith(cacheFirstWithNetworkFallback(request, SHELL_CACHE));
});

// ── Strategy helpers ─────────────────────────────────────────────

async function cacheFirstWithNetworkFallback(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Serve offline fallback for navigation requests
    if (request.mode === "navigate") {
      const offline = await caches.match("/offline");
      return offline || new Response("You are offline.", {
        status: 503,
        headers: { "Content-Type": "text/plain" },
      });
    }
    throw new Error("Network unavailable and no cache entry.");
  }
}

async function networkFirstWithCacheFallback(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ success: false, offline: true, error: "You are offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetchPromise;
}

// ── Push Notifications ───────────────────────────────────────────
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : {};
  const title   = data.title   || "RetailScan";
  const options = {
    body:    data.body    || "You have a new notification",
    icon:    "/static/icons/icon-192.png",
    badge:   "/static/icons/icon-72.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    actions: [
      { action: "open",    title: "Open App" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  if (event.action === "dismiss") return;
  const url = (event.notification.data || {}).url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(clientList => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
