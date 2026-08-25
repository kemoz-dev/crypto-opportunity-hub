const BUILD_ID = "crypto-hub-pwa-r2-20260825";
const CACHE_NAME = `crypto-hub-shell-${BUILD_ID}`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/build-info.json", "/offline.html", "/manus-storage/crypto-hub-pwa-icon_bc898f39.png"];

const isApiRequest = url => url.pathname.startsWith("/api/");
const isImmutableAsset = url => url.pathname.startsWith("/assets/") || SHELL_URLS.includes(url.pathname);

async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(SHELL_URLS);
  const response = await fetch("/", { cache: "reload" });
  const html = await response.text();
  const assets = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+(?:\?[^"#]*)?)"/g), match => match[1]);
  await cache.put("/", new Response(html, { headers: { "Content-Type": "text/html" } }));
  await cache.addAll(assets);
}

self.addEventListener("install", event => {
  event.waitUntil(precacheShell());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("crypto-hub-shell-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE_UPDATE") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isApiRequest(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put("/", copy));
        return response;
      }).catch(async () => (await caches.match("/")) || (await caches.match("/offline.html")))
    );
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
        return response;
      }))
    );
  }
});
