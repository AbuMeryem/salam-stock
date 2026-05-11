/* Salam Stock — Service Worker
 * Gère uniquement la réception des Web Push (iOS 16.4+ PWA standalone).
 * Pas de cache offline pour l'instant — l'app est servie via Next/Vercel.
 */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "Salam Stock", body: event.data.text() };
  }

  const title = data.title || "Salam Stock";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag || "salam-alert",
    data: {
      url: data.url || "/v2/admin",
      alerteId: data.alerteId || null,
    },
    vibrate: [200, 100, 200],
    requireInteraction: data.urgent === true,
    actions: [
      { action: "view", title: "Voir" },
      { action: "dismiss", title: "Ignorer" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const url = (event.notification.data && event.notification.data.url) || "/v2/admin";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
