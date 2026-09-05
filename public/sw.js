const CACHE = "etucenter-v3";
const STATIC_EXT = /\.(css|js|mjs|png|jpe?g|svg|ico|webp|woff2?|ttf|webmanifest)$/i;

// Pré-cache à l'installation : la coquille de l'application est disponible
// dès la première ouverture, même hors ligne.
const PRECACHE_URLS = ["/", "/login", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE_URLS.map((u) =>
          fetch(u, { credentials: "same-origin" })
            .then((r) => r.ok && cache.put(u, r))
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

// Prévenir les pages ouvertes qu'on sert des données du cache (mode hors ligne).
function notifyClients(url) {
  self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => clients.forEach((c) => c.postMessage({ type: "OFFLINE_SERVE", url })))
    .catch(() => {});
}

// Réseau d'abord, avec repli sur le cache : tant qu'on est en ligne on
// rafraîchit, hors ligne on sert la dernière version mise en cache.
async function networkFirst(request, { notify = false } = {}) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response || new Response("Erreur", { status: 502 });
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      if (notify) notifyClients(request.url);
      return cached;
    }
    throw new Error("Hors ligne");
  }
}

// Cache d'abord pour les fichiers statiques (rapide + disponible hors ligne).
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response || new Response("Erreur", { status: 502 });
}

// Repli hors ligne : sert le cache si disponible, sinon la coquille HTML.
async function offlineRespond(request) {
  const cache = await caches.open(CACHE);
  const isRsc = request.headers.get("RSC") === "1";
  const cached = await cache.match(request);
  if (cached) {
    const isHtml = (cached.headers.get("Content-Type") || "").includes("text/html");
    // Ne jamais servir du HTML brut à une requête RSC (casserait le routeur Next.js).
    if (isRsc && isHtml && request.mode !== "navigate") {
      throw new Error("Navigation indisponible hors ligne");
    }
    notifyClients(request.url);
    return cached;
  }
  if (request.mode === "navigate") {
    const shell = await cache.match("/");
    if (shell) {
      notifyClients(request.url);
      return shell;
    }
  }
  throw new Error("Hors ligne");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Données API en lecture : réseau d'abord, repli sur la dernière version.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      networkFirst(request, { notify: true }).catch(() =>
        new Response(JSON.stringify({ error: "Hors ligne", offline: true }), {
          status: 503,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        })
      )
    );
    return;
  }

  // Fichiers statiques : rapides et disponibles hors ligne.
  if (STATIC_EXT.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Pages et chunks Next.js : réseau d'abord, repli sur le cache.
  event.respondWith(
    networkFirst(request, { notify: true }).catch(() =>
      offlineRespond(request).catch(() =>
        new Response("Hors ligne", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      )
    )
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Gestion Centre", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Gestion Centre";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    silent: false,
    tag: "etucenter-" + (data.tag || Date.now()),
    timestamp: Date.now(),
    data: { url: data.url || "/", dateOfArrival: Date.now() },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })()
  );
});