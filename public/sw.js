const CACHE = "etucenter-v4";
const STATIC_EXT = /\.(css|js|mjs|png|jpe?g|svg|ico|webp|woff2?|ttf|webmanifest)$/i;
const PRECACHE_URLS = ["/offline.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE_URLS.map((u) =>
          fetch(u, { credentials: "same-origin" })
            .then((r) => { if (r.ok) return cache.put(u, r); })
            .catch(() => {})
        )
      );
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

function notifyClients(url) {
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((c) => c.forEach((cl) => cl.postMessage({ type: "OFFLINE_SERVE", url })))
    .catch(() => {});
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      notifyClients(request.url);
      return cached;
    }
    return null;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return null;
  }
}

async function offlinePage() {
  const cache = await caches.open(CACHE);
  return (await cache.match("/offline.html")) || new Response("Hors ligne", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API : network-first, cache en repli
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      networkFirst(request).then((r) => {
        if (r) return r;
        return new Response(JSON.stringify({ error: "Hors ligne", offline: true }), {
          status: 503,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        });
      })
    );
    return;
  }

  // Fichiers statiques : cache-first
  if (STATIC_EXT.test(url.pathname)) {
    event.respondWith(
      cacheFirst(request).then((r) => {
        if (r) return r;
        return new Response("", { status: 503 });
      })
    );
    return;
  }

  // Pages et navigation : network-first, cache, sinon page hors ligne
  event.respondWith(
    networkFirst(request).then((r) => {
      if (r) return r;
      // Tentative de servir depuis le cache générique
      return caches.open(CACHE).then((cache) => cache.match(request)).then((c) => {
        if (c) { notifyClients(url.pathname); return c; }
        // Pour toute navigation (premiere ouverture offline), montrer la page hors ligne
        if (request.mode === "navigate") return offlinePage();
        return new Response("", { status: 503 });
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Gestion Centre", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "Gestion Centre", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      tag: "etucenter-" + (data.tag || Date.now()),
      data: { url: data.url || "/", dateOfArrival: Date.now() },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clients) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })()
  );
});
