// Network-first service worker. Never caches API, auth or OAuth traffic.
const CACHE = "redress-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/~oauth") || url.pathname.startsWith("/api")) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/").then((r) => r || Response.error())));
    return;
  }
  if (/\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
