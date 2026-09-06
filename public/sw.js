const CACHE = "etucenter-v5";
const STATIC_EXT = /\.(css|js|mjs|png|jpe?g|svg|ico|webp|woff2?|ttf|webmanifest)$/i;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        ["/offline.html", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"].map((u) =>
          fetch(u, { credentials: "same-origin" }).then((r) => {
            if (r.ok) return cache.put(u, r);
          })
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function notifyClients(url) {
  self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((c) =>
    c.forEach((cl) => cl.postMessage({ type: "OFFLINE_SERVE", url }))
  ).catch(() => {});
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const key = url.pathname + url.search;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // 1. Essayer le réseau
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          cache.put(key, response.clone());
          return response;
        }
      } catch {}

      // 2. Repli sur le cache (clé = URL string, ignore Vary)
      const cached = await cache.match(key, { ignoreVary: true });
      if (cached) {
        notifyClients(url.pathname);
        return cached;
      }

      // 3. Dernier recours : page hors ligne pour la navigation
      if (request.mode === "navigate") {
        const offline = await cache.match("/offline.html", { ignoreVary: true });
        if (offline) return offline;
      }

      return new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
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
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const c of clients) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
