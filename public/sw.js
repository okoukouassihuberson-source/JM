/* Service worker JM Poissonnerie : réception des notifications push (téléphone verrouillé / site fermé). */
const CACHE = "jm-shell-v1";
const SHELL = ["/offline.html", "/icons/icon-192.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Pages : toujours le réseau (données fraîches) ; page « hors connexion » seulement si le réseau est coupé.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
});

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { title: "JM Poissonnerie", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(
    self.registration.showNotification(d.title || "JM Poissonnerie", {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag || "jm",
      renotify: true,
      vibrate: [250, 120, 250, 120, 250],
      requireInteraction: true,
      data: { link: d.link || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) { if ("navigate" in c) c.navigate(link); return c.focus(); }
      return self.clients.openWindow(link);
    }),
  );
});
