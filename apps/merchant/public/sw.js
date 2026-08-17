// CheckPass Club service worker (spec 0037). Served from the root scope (`/sw.js` ⇒ scope
// `/`) so it can receive Web Push for the whole origin. Deliberately minimal: no offline
// caching (out of scope) — only `push` (show the notice) and `notificationclick` (open
// the portal). The push payload is the JSON the `webpush` channel encrypts: {title, body,
// url}. Keep in sync with `server/push/webpush-channel.ts` (WebPushPayload).

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "CheckPass Club";
  const options = {
    body: data.body || "",
    icon: "/wallet-logo.png",
    badge: "/wallet-logo.png",
    data: { url: data.url || "/wallet" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url =
    (event.notification.data && event.notification.data.url) || "/wallet";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of all) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })(),
  );
});
