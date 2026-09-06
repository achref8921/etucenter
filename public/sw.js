const CACHE = "etucenter-v6";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(
        ["/offline.html", "/icon-192.png", "/icon-512.png"].map((u) =>
          fetch(u, { credentials: "same-origin" })
            .then((r) => { if (r.ok) return cache.put(u, r); })
            .catch(() => {})
        )
      )
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const key = url.pathname + url.search;

  event.respondWith(
    (async () => {
      // 1. Toujours essayer le réseau d'abord
      try {
        const response = await fetch(request);
        // Mettre en cache en arrière-plan si succès
        if (response && response.ok) {
          caches.open(CACHE).then((cache) => {
            cache.put(key, response.clone()).catch(() => {});
          }).catch(() => {});
        }
        return response;
      } catch {}

      // 2. Hors ligne : servir depuis le cache
      try {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(key, { ignoreVary: true });
        if (cached) return cached;
      } catch {}

      // 3. Page de navigation sans cache : page hors ligne
      if (request.mode === "navigate") {
        try {
          const cache = await caches.open(CACHE);
          const offline = await cache.match("/offline.html", { ignoreVary: true });
          if (offline) return offline;
        } catch {}
      }

      return new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    })()
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Gestion Centre" }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "Gestion Centre", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      tag: "etucenter-" + (data.tag || Date.now()),
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const c of clients) { if ("focus" in c) { c.navigate(url); return c.focus(); } }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
