import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

/**
 * Spec 0103 §9 — `public/sw.js` reports the click of a campaign Web Push. The REAL file
 * runs in a `vm` with a fake `self`: `push` must keep the `clickId` on the notification,
 * and `notificationclick` must POST it to the click endpoint inside the event's
 * `waitUntil` while still navigating. `keepalive` itself has no automatic oracle (QA).
 */
function loadWorker(fetchImpl: (...args: unknown[]) => Promise<unknown>) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const shown: { title: string; options: { data: unknown } }[] = [];
  const opened: string[] = [];
  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = fn;
    },
    registration: {
      showNotification: async (title: string, options: { data: unknown }) => {
        shown.push({ title, options });
      },
    },
    clients: {
      matchAll: async () => [],
      openWindow: async (url: string) => {
        opened.push(url);
      },
    },
  };
  const source = readFileSync(
    join(import.meta.dirname, "../../public/sw.js"),
    "utf8",
  );
  runInNewContext(source, { self, fetch: fetchImpl });
  return { listeners, shown, opened };
}

async function clickWith(data: unknown, fetchImpl = vi.fn(async () => ({}))) {
  const worker = loadWorker(fetchImpl);
  const waits: Promise<unknown>[] = [];
  worker.listeners.push({
    data: { json: () => data },
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  });
  await Promise.all(waits.splice(0));
  const notification = worker.shown[0];
  worker.listeners.notificationclick({
    notification: { close: () => {}, data: notification.options.data },
    waitUntil: (p: Promise<unknown>) => waits.push(p),
  });
  await Promise.all(waits);
  return { fetchImpl, opened: worker.opened };
}

describe("sw.js — the click of a campaign push", () => {
  it("POSTs `{id: clickId}` to /api/public/push/click and still opens the url", async () => {
    const { fetchImpl, opened } = await clickWith({
      title: "La Gringa",
      body: "¡Volvé!",
      url: "/wallet",
      clickId: "p-1",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/public/push/click");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ id: "p-1" });
    expect(init.keepalive).toBe(true);
    expect(opened).toEqual(["/wallet"]);
  });

  it("a notice without clickId reports nothing; a failing report never breaks the navigation", async () => {
    const quiet = await clickWith({ title: "La Gringa", body: "+1 sello" });
    expect(quiet.fetchImpl).not.toHaveBeenCalled();
    expect(quiet.opened).toEqual(["/wallet"]);

    const failing = await clickWith(
      { title: "La Gringa", body: "x", clickId: "p-2" },
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    expect(failing.opened).toEqual(["/wallet"]);
  });
});
