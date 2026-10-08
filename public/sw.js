/* Service worker JM Poissonnerie : réception des notifications push (téléphone verrouillé / site fermé). */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

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
