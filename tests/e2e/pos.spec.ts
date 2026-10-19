// 0242: legacy UI cases mapped to current suites in the P4 handoff.
import { expect, test } from "@playwright/test";
import {
  detailKey,
  historyKey,
  DiscardedPosRead,
  PosCache,
} from "../../apps/merchant/src/modules/pos/ui/pos-cache";
import type { PosOrder } from "../../apps/merchant/src/modules/pos/ui/pos-types";
const baseOrder: PosOrder = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  tableLabel: "Mesa 4",
  note: null,
  status: "open",
  version: 1,
  location: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", name: "Centro" },
  business: { name: "Café de prueba", currencyCode: "USD" },
  items: [
    {
      lineId: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
      productId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
      name: "Café",
      quantity: 1,
      unitPrice: "10.00",
      lineTotal: "10.00",
    },
  ],
  total: "10.00",
  createdAt: "2026-10-08T12:00:00Z",
  createdBy: "Ana",
  closedAt: null,
  closedBy: null,
  sale: null,
};
test("caché POS: lecturas concurrentes se deduplican y generaciones viejas se descartan", async () => {
  const cache = new PosCache();
  cache.bind("operator:business");
  let calls = 0;
  let release!: (order: PosOrder) => void;
  const request = () => {
    calls += 1;
    return new Promise<PosOrder>((resolve) => {
      release = resolve;
    });
  };
  const first = cache.read(detailKey(baseOrder.id), request);
  const second = cache.read(detailKey(baseOrder.id), request);
  expect(first).toBe(second);
  expect(calls).toBe(1);
  const discarded = expect(first).rejects.toBeInstanceOf(DiscardedPosRead);
  cache.beginWrite(baseOrder.id);
  cache.accept({ ...baseOrder, version: 2 });
  release(baseOrder);
  await discarded;
  expect(cache.peek<PosOrder>(detailKey(baseOrder.id))?.version).toBe(2);
  await expect(cache.order(baseOrder.id)).resolves.toMatchObject({
    version: 2,
  });
});
test("caché POS: historial anterior no revierte escritura y cambio de contexto invalida respuestas", async () => {
  const cache = new PosCache();
  cache.bind("operator:business-1");
  cache.put(historyKey, {
    open: [{ ...baseOrder, itemCount: 1, saleTotal: null }],
    closedToday: [],
  });
  let release!: (value: unknown) => void;
  const previous = cache.read(
    historyKey,
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    true,
  );
  const discarded = expect(previous).rejects.toBeInstanceOf(DiscardedPosRead);
  cache.beginWrite(baseOrder.id);
  cache.accept({ ...baseOrder, version: 2, tableLabel: "Mesa nueva" });
  release({ open: [baseOrder], closedToday: [] });
  await discarded;
  expect(
    cache.peek<{ open: { tableLabel: string }[] }>(historyKey, true)?.open[0]
      .tableLabel,
  ).toBe("Mesa nueva");
  const oldContext = cache.read(
    detailKey("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"),
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const oldDiscarded =
    expect(oldContext).rejects.toBeInstanceOf(DiscardedPosRead);
  cache.bind("operator:business-2");
  release(baseOrder);
  await oldDiscarded;
  expect(cache.peek(detailKey(baseOrder.id), true)).toBeNull();
  expect(
    cache.peek(detailKey("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"), true),
  ).toBeNull();
});
