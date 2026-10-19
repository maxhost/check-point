import { expect, it } from "vitest";
import type { PosHistoryV2, PosOrderV2 } from "../contracts";
import { MeasuredOrderCache } from "./measured-order-cache";
import { PosCache, DiscardedPosRead, detailKey, historyKey } from "./pos-cache";

const order = (
  version: number,
  status: PosOrderV2["status"] = "open",
): PosOrderV2 => ({
  contractVersion: 2,
  id: "o",
  version,
  status,
  saleType: "pickup",
  orderLabel: "Pedido",
  tableLabel: "Pedido",
  tableId: null,
  location: null,
  note: null,
  business: { name: "Shop", currencyCode: "USD" },
  total: "2.50",
  createdAt: "2026-10-18",
  createdBy: "u",
  closedAt: null,
  closedBy: null,
  sale: null,
  settlement: null,
  items: [
    {
      lineId: "mass",
      productId: "p",
      name: "Mass",
      quantity: "0.125",
      unitPrice: "20",
      lineTotal: "2.50",
      measure: {
        kind: "mass",
        quantityUnit: "kg",
        priceUnit: "kg",
        conversionVersion: "mass-si-1",
      },
    },
    {
      lineId: "unit",
      productId: "q",
      name: "Unit",
      quantity: "3",
      unitPrice: "0",
      lineTotal: "0",
      measure: {
        kind: "unit",
        quantityUnit: "unit",
        priceUnit: "unit",
        conversionVersion: "mass-si-1",
      },
    },
  ],
});
it("uses the same cache, keeps the highest version and patches lineCount without summing quantities", () => {
  const cache = new PosCache();
  cache.bind("A");
  cache.put(historyKey, { open: [], closedToday: [] });
  const facade = new MeasuredOrderCache(cache, "active");
  facade.accept(order(5));
  expect(facade.accept(order(2)).version).toBe(5);
  expect(cache.peek<PosOrderV2>(detailKey("o"))?.version).toBe(5);
  expect(cache.peek<PosHistoryV2>(historyKey)?.open[0]).toMatchObject({
    version: 5,
    lineCount: 2,
    total: "2.50",
    saleTotal: null,
  });
  expect(cache.peek<PosHistoryV2>(historyKey)?.open[0]).not.toHaveProperty(
    "itemCount",
  );
});
it("discards pending old detail and history reads on canonical write", async () => {
  const cache = new PosCache();
  const facade = new MeasuredOrderCache(cache, "active");
  let resolveOrder!: (value: PosOrderV2) => void;
  let resolveHistory!: (value: PosHistoryV2) => void;
  const detail = cache.read(
    detailKey("o"),
    () =>
      new Promise<PosOrderV2>((resolve) => {
        resolveOrder = resolve;
      }),
  );
  const history = cache.read(
    historyKey,
    () =>
      new Promise<PosHistoryV2>((resolve) => {
        resolveHistory = resolve;
      }),
  );
  cache.put(historyKey, { open: [], closedToday: [] });
  facade.accept(order(5));
  resolveOrder(order(1));
  resolveHistory({ open: [], closedToday: [] });
  await expect(detail).rejects.toBeInstanceOf(DiscardedPosRead);
  await expect(history).rejects.toBeInstanceOf(DiscardedPosRead);
  expect(cache.peek<PosOrderV2>(detailKey("o"))?.version).toBe(5);
  expect(cache.peek<PosHistoryV2>(historyKey)?.open).toHaveLength(1);
});
it("never creates missing history and keeps an uncertain closed-day projection invalid without fetching", () => {
  const cache = new PosCache();
  const facade = new MeasuredOrderCache(cache, "active");
  facade.accept(order(1));
  expect(cache.peek(historyKey, true)).toBeNull();
  cache.put(historyKey, { open: [], closedToday: [] });
  facade.accept(order(2, "closed"));
  expect(cache.peek(historyKey)).toBeNull();
  expect(cache.peek(historyKey, true)).toEqual({ open: [], closedToday: [] });
});
it("patches known closed/voided historical rows and preserves invalidity", () => {
  const cache = new PosCache();
  const facade = new MeasuredOrderCache(cache, "active");
  cache.put(
    historyKey,
    { open: [], closedToday: [{ ...order(1), lineCount: 2, saleTotal: null }] },
    false,
  );
  facade.accept(order(2, "voided"));
  expect(cache.peek(historyKey)).toBeNull();
  expect(
    cache.peek<PosHistoryV2>(historyKey, true)?.closedToday[0],
  ).toMatchObject({ version: 2, status: "voided", lineCount: 2 });
});
it("never downgrades a summary that already observed a higher revision", () => {
  const cache = new PosCache();
  const facade = new MeasuredOrderCache(cache, "active");
  cache.put(historyKey, { open: [], closedToday: [] });
  facade.accept(order(9));
  cache.invalidate(detailKey("o"));
  cache.put(detailKey("o"), order(1));
  expect(() => facade.accept(order(3))).toThrow("Revisa la versión actual");
  expect(cache.peek(detailKey("o"))).toBeNull();
  expect(cache.peek<PosHistoryV2>(historyKey)?.open[0].version).toBe(9);
});
it("retains epoch isolation and deduplicated reads through the shared public cache", async () => {
  const cache = new PosCache();
  cache.bind("A");
  let resolve!: (value: PosOrderV2) => void;
  const request = () =>
    new Promise<PosOrderV2>((yes) => {
      resolve = yes;
    });
  const first = cache.read(detailKey("o"), request);
  const duplicate = cache.read(detailKey("o"), request);
  expect(duplicate).toBe(first);
  cache.bind("B");
  resolve(order(1));
  await expect(first).rejects.toBeInstanceOf(DiscardedPosRead);
  expect(cache.peek(detailKey("o"))).toBeNull();
});
it("an explicit voided history never receives open or closed orders", () => {
  const cache = new PosCache("voided");
  const facade = new MeasuredOrderCache(cache, "voided");
  cache.put(historyKey, { open: [], closedToday: [] });
  facade.accept(order(1));
  expect(cache.peek(historyKey)).toEqual({ open: [], closedToday: [] });
  facade.accept(order(2, "closed"));
  expect(cache.peek(historyKey)).toEqual({ open: [], closedToday: [] });
  facade.accept(order(3, "voided"));
  expect(cache.peek(historyKey)).toBeNull();
  expect(cache.peek<PosOrderV2>(detailKey("o"))?.version).toBe(3);
});
