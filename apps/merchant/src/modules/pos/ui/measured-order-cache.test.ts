import { buildFinancialSettlement } from "@mi-pasaporte/domain/financial";
import { expect, it } from "vitest";
import type { PosHistoryV2, PosOrderV2 } from "../contracts";
import { MeasuredOrderCache } from "./measured-order-cache";
import {
  PosCache,
  DiscardedPosRead,
  detailKey,
  historyKey,
  tablesKey,
} from "./pos-cache";
import type { PosTable } from "./pos-tables";

it("actualiza la ocupación de mesas desde respuestas canónicas sin recargar ni mezclar locales", () => {
  const cache = new PosCache();
  const facade = new MeasuredOrderCache(cache, "active");
  const tables = [
    { id: "t1", name: "Mesa 1", openOrderId: null },
    { id: "t2", name: "Mesa 2", openOrderId: "other" },
  ];
  cache.put(tablesKey("north"), { tables });
  cache.put(tablesKey("south"), { tables });
  const tableOrder = {
    ...order(1),
    saleType: "table" as const,
    tableId: "t1",
    location: { id: "north", name: "Norte" },
  };
  facade.accept(tableOrder);
  expect(
    cache
      .peek<{ tables: PosTable[] }>(tablesKey("north"))
      ?.tables.map((t) => t.openOrderId),
  ).toEqual(["o", "other"]);
  expect(
    cache
      .peek<{ tables: PosTable[] }>(tablesKey("south"))
      ?.tables.map((t) => t.openOrderId),
  ).toEqual([null, "other"]);
  facade.accept({ ...tableOrder, status: "closed" });
  expect(
    cache
      .peek<{ tables: PosTable[] }>(tablesKey("north"))
      ?.tables.map((t) => t.openOrderId),
  ).toEqual([null, "other"]);
});

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
  closedAt: status === "open" ? null : "2026-10-18T12:00:00Z",
  closedBy: status === "open" ? null : "u",
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
it("projects a canonical close only into the explicit business-local day without marking stale history fresh", () => {
  const cache = new PosCache();
  cache.put(historyKey, { open: [], closedToday: [] }, false);
  const facade = new MeasuredOrderCache(cache, "active");
  const closed = { ...order(1, "closed"), closedAt: "2026-10-19T03:59:59Z" };
  const window = {
    timeZone: "America/Guayaquil",
    now: new Date("2026-10-19T04:59:59Z"),
  };
  facade.accept(closed, { historyWindow: window });
  expect(cache.peek(historyKey)).toBeNull();
  expect(cache.peek<PosHistoryV2>(historyKey, true)?.closedToday).toHaveLength(
    1,
  );
  // A replay after the business midnight removes the row from today's projection.
  facade.accept(closed, {
    historyWindow: { ...window, now: new Date("2026-10-19T05:00:00Z") },
  });
  expect(cache.peek<PosHistoryV2>(historyKey, true)?.closedToday).toHaveLength(
    0,
  );
  // The same instant belongs to the next day in UTC, not in the business zone.
  facade.accept(closed, {
    historyWindow: { timeZone: "UTC", now: new Date("2026-10-19T05:00:00Z") },
  });
  expect(cache.peek<PosHistoryV2>(historyKey, true)?.closedToday).toHaveLength(
    1,
  );
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

const settlement = buildFinancialSettlement({
  currencyCode: "USD",
  lines: [{ sourceLineId: "l", position: 0, quantity: 1, unitPrice: "10.00" }],
  discount: {
    amount: "2.00",
    origin: { type: "campaign_coupon", sourceId: "coupon", scope: "order" },
  },
  payments: [{ paymentId: "payment", methodId: "cash", amount: "8.00" }],
});
it.each(["open", "closed", "voided"] as const)(
  "projects %s frozen monetary totals without requiring a loyalty sale",
  (status) => {
    const cache = new PosCache();
    const facade = new MeasuredOrderCache(cache, "active");
    cache.put(historyKey, {
      open: [],
      closedToday: [{ ...order(1, status), lineCount: 2, saleTotal: null }],
    });
    facade.accept({
      ...order(2, status),
      total: "10.00",
      settlement,
      items: [
        {
          ...order(2).items[1],
          lineId: "l",
          quantity: "1",
          unitPrice: "10.00",
          lineTotal: "10.00",
        },
      ],
      sale: null,
    });
    const history = cache.peek<PosHistoryV2>(historyKey)!;
    const summary =
      status === "open" ? history.open[0] : history.closedToday[0];
    expect(summary).toMatchObject({
      total: status === "closed" ? "8.00" : "10.00",
      saleTotal: status === "closed" ? "8.00" : null,
    });
    expect(cache.peek<PosOrderV2>(detailKey("o"))?.total).toBe("10.00");
  },
);
it("uses the legacy closed sale total fallback, then gross when no sale snapshot exists", () => {
  const cache = new PosCache();
  const facade = new MeasuredOrderCache(cache, "active");
  cache.put(historyKey, {
    open: [],
    closedToday: [{ ...order(1, "closed"), lineCount: 2, saleTotal: null }],
  });
  const sale: PosOrderV2["sale"] = {
    consumer: "Consumer",
    total: "2.00",
    grossTotal: "2.50",
    unitsGranted: 0,
    balanceAfter: 0,
    kind: "points",
    coupon: null,
  };
  facade.accept({ ...order(2, "closed"), sale });
  expect(cache.peek<PosHistoryV2>(historyKey)?.closedToday[0]).toMatchObject({
    total: "2.00",
    saleTotal: "2.00",
  });
  facade.accept(order(3, "closed"));
  expect(cache.peek<PosHistoryV2>(historyKey)?.closedToday[0]).toMatchObject({
    total: "2.50",
    saleTotal: "2.50",
  });
});
it.each(["closed", "voided"] as const)(
  "preserves terminal %s detail and history on same-version late open response",
  (status) => {
    const cache = new PosCache();
    const facade = new MeasuredOrderCache(cache, "active");
    cache.put(detailKey("o"), order(3, status));
    cache.put(historyKey, {
      open: [],
      closedToday: [{ ...order(3, status), lineCount: 2, saleTotal: null }],
    });
    expect(facade.accept(order(3)).status).toBe(status);
    expect(cache.peek<PosOrderV2>(detailKey("o"))?.status).toBe(status);
    expect(cache.peek<PosHistoryV2>(historyKey)?.open).toEqual([]);
    expect(cache.peek<PosHistoryV2>(historyKey)?.closedToday[0].status).toBe(
      status,
    );
  },
);
it.each(["closed", "voided"] as const)(
  "requires explicit review when only a %s summary defeats the same-version late open DTO",
  (status) => {
    const cache = new PosCache();
    const facade = new MeasuredOrderCache(cache, "active");
    const history = {
      open: [],
      closedToday: [{ ...order(3, status), lineCount: 2, saleTotal: null }],
    };
    cache.put(historyKey, history);
    expect(() => facade.accept(order(3))).toThrow("Revisa la versión actual");
    expect(cache.peek(detailKey("o"))).toBeNull();
    expect(cache.peek<PosOrderV2>(detailKey("o"), true)?.status).toBe("open");
    expect(cache.peek(historyKey)).toEqual(history);
  },
);
it("discards a history read begun after beginWrite when no history snapshot exists", async () => {
  const cache = new PosCache();
  const facade = new MeasuredOrderCache(cache, "active");
  cache.beginWrite();
  let resolve!: (value: PosHistoryV2) => void;
  const pending = cache.read(
    historyKey,
    () =>
      new Promise<PosHistoryV2>((yes) => {
        resolve = yes;
      }),
  );
  facade.accept(order(3));
  resolve({ open: [], closedToday: [] });
  await expect(pending).rejects.toBeInstanceOf(DiscardedPosRead);
  expect(cache.peek(historyKey, true)).toBeNull();
});
