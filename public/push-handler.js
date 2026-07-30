// Paths are resolved against the registration scope so the app keeps working
// when it is hosted under a sub-path (e.g. GitHub Pages project sites).
const scopeUrl = () => new URL(self.registration.scope);
const scoped = (path) => new URL(`.${path}`, scopeUrl()).href;

self.addEventListener("push", (event) => {
  let data = { title: "Plotline", body: "You have something due", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    data.body = event.data?.text() ?? data.body;
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: scoped("/pwa-192.png"),
      badge: scoped("/pwa-192.png"),
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.url ?? "/";
  const target = scoped(path);

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (!client.url.startsWith(self.location.origin)) continue;
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(target);
            }
            return client;
          }
        }
        if (clients.openWindow) return clients.openWindow(target);
      }),
  );
});
