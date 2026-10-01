// Check Pass Club service worker (spec 0037). Served from the root scope (`/sw.js` ⇒ scope
// `/`) so it can receive Web Push for the whole origin. Deliberately minimal: no offline
// caching (out of scope) — only `push` (show the notice) and `notificationclick` (open
// the portal). The push payload is the JSON the `webpush` channel encrypts: {title, body,
// url, clickId?}. Keep in sync with `server/push/webpush-channel.ts` (WebPushPayload).
// `clickId` (spec 0103) is a campaign push: on click it is reported to
// `POST /api/public/push/click`, best-effort — the navigation never waits on it nor fails.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Check Pass Club";
  const options = {
    body: data.body || "",
    icon: "/checkpass-icon-192.png",
    badge: "/checkpass-badge-96.png",
    data: { url: data.url || "/wallet", clickId: data.clickId || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || "/wallet";
  const report = data.clickId
    ? fetch("/api/public/push/click", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: data.clickId }),
        keepalive: true,
      }).catch(() => {})
    : Promise.resolve();
  const open = (async () => {
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
  })();
  // ONE `waitUntil` keeps the worker alive for both; neither waits for the other.
  event.waitUntil(Promise.all([report, open]));
});
