// Service worker for Learn to Ride VC web push notifications.
// Handles `push` events, badge updates, and click-through to the dashboard.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: "Notification", body: event.data ? event.data.text() : "" }; }

  const title = data.title || "Learn to Ride VC";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: data.tag || "notification",
    renotify: true,
    data: { url: data.url || "/employee-dashboard" },
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // App icon badge (Android Chrome, iOS Safari PWA)
    if ("setAppBadge" in self.navigator) {
      try { await self.navigator.setAppBadge(); } catch (_) {}
    }
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/employee-dashboard";
  event.waitUntil((async () => {
    if ("clearAppBadge" in self.navigator) {
      try { await self.navigator.clearAppBadge(); } catch (_) {}
    }
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      try {
        const u = new URL(c.url);
        if (u.pathname.startsWith("/employee-dashboard")) {
          await c.focus();
          if ("navigate" in c) c.navigate(target);
          return;
        }
      } catch (_) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
