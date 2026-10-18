import { expect, it, vi } from "vitest";
import { DiscardedPosRead, PosCache, detailKey } from "./pos-cache";
import type { PosOrder } from "./pos-types";
const order = (version: number) =>
  ({
    id: "id",
    version,
    status: "open",
    items: [],
    createdAt: "",
  }) as unknown as PosOrder;
it("isolates scope epochs and never repopulates from a late previous read", async () => {
  const cache = new PosCache();
  cache.bind("A:local");
  let resolve!: (value: string) => void;
  const pending = cache.read(
    "catalog",
    () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
  );
  cache.bind("B:local");
  cache.put("catalog", "B");
  resolve("A");
  await expect(pending).rejects.toBeInstanceOf(DiscardedPosRead);
  expect(cache.peek("catalog")).toBe("B");
});
it("keeps newer order versions against late reads and writes", async () => {
  const cache = new PosCache();
  cache.bind("A:local");
  let resolve!: (value: PosOrder) => void;
  const pending = cache.read(
    detailKey("id"),
    () =>
      new Promise<PosOrder>((done) => {
        resolve = done;
      }),
  );
  cache.put(detailKey("id"), order(5));
  resolve(order(2));
  expect((await pending).version).toBe(5);
  expect(cache.accept(order(3)).version).toBe(5);
  expect(cache.bind("A:local")).toBe(false);
});
it("deduplicates an in-flight list and uses injected scoped transport", async () => {
  const request = vi.fn(async () => ({ open: [], closedToday: [] }));
  const cache = new PosCache(undefined, request as never);
  cache.bind("scope:local");
  await Promise.all([cache.history(), cache.history()]);
  expect(request).toHaveBeenCalledOnce();
});
