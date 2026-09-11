/*
 * OptiLifeWellbeing CRM — service worker.
 *
 * Deliberately narrow: this exists to make the app installable and to make
 * launching it from the home screen instant. It is NOT an offline database.
 *
 * Hard rule: nothing under /api/ is ever cached, and nothing but GET is ever
 * cached. Orders, stock levels and customer records always come from the
 * network, so the installed app can never show stale business data.
 *
 * Bump CACHE_VERSION to force every client onto a fresh cache.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `optilife-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `optilife-assets-${CACHE_VERSION}`;
const FONT_CACHE = `optilife-fonts-${CACHE_VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, ASSET_CACHE, FONT_CACHE];

// Enough to boot the SPA offline. Hashed bundles are picked up at runtime
// instead of being precached, which keeps this file build-step free.
const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/logo.png", "/icons/icon-192.png"];

const FONT_ORIGINS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Offline — OptiLifeWellbeing</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#F5FAF8;color:#1F332E;font:16px/1.5 Inter,system-ui,-apple-system,sans-serif;
       padding:24px;text-align:center}
  .box{max-width:22rem}
  h1{font-size:1.25rem;margin:0 0 .5rem}
  p{margin:0 0 1.5rem;color:#6B7F7A}
  button{background:#2C6D62;color:#fff;border:0;border-radius:.5rem;
         padding:.75rem 1.5rem;font:inherit;font-weight:600;min-height:44px;cursor:pointer}
</style></head>
<body><div class="box">
  <h1>You're offline</h1>
  <p>OptiLife needs a connection to load your orders and customers.</p>
  <button onclick="location.reload()">Try again</button>
</div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Individually, so one 404 can't fail the whole install.
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("optilife-") && !CURRENT_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/** Cache-first: for content-hashed assets and fonts, which never change in place. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // Opaque (cross-origin font) responses have status 0 but are still usable.
  if (response && (response.ok || response.type === "opaque")) {
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first: for navigations, so a deploy is picked up immediately. */
async function navigationHandler(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put("/index.html", response.clone());
    return response;
  } catch {
    // The SPA router handles the path itself, so any cached shell will do.
    const cached = (await cache.match("/index.html")) || (await cache.match("/"));
    if (cached) return cached;
    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never touch writes, or anything that isn't a plain GET.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache the API. Business data is always live.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  // Let the browser handle range requests and non-basic schemes itself.
  if (request.headers.has("range") || !url.protocol.startsWith("http")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  if (FONT_ORIGINS.includes(url.origin)) {
    event.respondWith(cacheFirst(request, FONT_CACHE));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Vite emits content-hashed filenames into /assets, so these are immutable.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (url.pathname.startsWith("/icons/") || SHELL_URLS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
  }
});
