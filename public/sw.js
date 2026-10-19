const CACHE = "etucenter-v10";

const SKIP_CACHE = /^\/(?:api\/|_next\/data\/)/;

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

  // Les réponses API ne doivent jamais être servies depuis le cache :
  // le filtre groupes->élèves dépend de données fraîches /api/admin/groupes.
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {}

      try {
        const cached = await caches.match(request, { ignoreVary: true });
        if (cached) return cached;
      } catch {}

      if (request.mode === "navigate") {
        try {
          const offline = await caches.match("/offline.html", { ignoreVary: true });
          if (offline) return offline;
        } catch {}
      }

      return new Response("Hors ligne", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    })()
  );
});

async function fetchSessionUserId() {
  const res = await fetch("/api/auth/session", {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("session http " + res.status);
  const data = await res.json().catch(() => null);
  return (data && data.user && data.user.id) || null;
}

async function dropStaleSubscription(endpoint, targetUserId) {
  try {
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, userId: targetUserId }),
    });
  } catch {}
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: "Ètudna" }; }

  const targetUserId = typeof data.userId === "string" ? data.userId : null;

  event.waitUntil(
    (async () => {
      // Charge utile sans destinataire : rien n'est affiché.
      if (!targetUserId) return;

      let sessionUserId = null;
      let sessionKnown = false;
      try {
        sessionUserId = await fetchSessionUserId();
        sessionKnown = true;
      } catch {
        sessionKnown = false;
      }

      // Vérification impossible (réseau) : on ne peut pas prouver le
      // destinataire, on n'affiche donc rien (sans toucher au serveur).
      if (!sessionKnown) return;

      // Le compte ouvert sur cet appareil n'est PAS le destinataire (déconnecté
      // ou autre compte partagé sur ce téléphone) : pas d'alerte, et la ligne
      // d'abonnement obsolète est retirée pour couper la livraison.
      if (sessionUserId !== targetUserId) {
        try {
          const sub = await self.registration.pushManager.getSubscription();
          if (sub) await dropStaleSubscription(sub.endpoint, targetUserId);
        } catch {}
        return;
      }

      await self.registration.showNotification(data.title || "Ètudna", {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        vibrate: [200, 100, 200],
        tag: "etucenter-" + (data.tag || Date.now()),
        data: { url: data.url || "/" },
      });
    })()
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
