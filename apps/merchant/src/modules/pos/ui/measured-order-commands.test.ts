import { afterEach, describe, expect, it, vi } from "vitest";
import type { PosCreateV2, PosOrderV2, PosUpdateV2 } from "../contracts";
import { PosCache, detailKey, historyKey } from "./pos-cache";
import { createPosClient } from "./pos-context";
import { PosError } from "./pos-types";
import { MeasuredOrderCommands } from "./measured-order-commands";

const draft: Omit<PosCreateV2, "createRequestId"> = {
  saleType: "pickup",
  orderLabel: "Pedido",
  locationId: null,
  tableId: null,
  note: null,
  items: [
    {
      productId: "p",
      quantity: "0.125",
      quantityUnit: "kg",
      catalogRevision: "7",
    },
  ],
};
const order = (overrides: Partial<PosOrderV2> = {}): PosOrderV2 => ({
  contractVersion: 2,
  id: "o",
  version: 1,
  status: "open",
  saleType: "pickup",
  orderLabel: "Pedido",
  tableLabel: "Pedido",
  tableId: null,
  location: null,
  note: null,
  business: { name: "Shop", currencyCode: "USD" },
  items: [],
  total: "2.50",
  createdAt: "2026-10-18",
  createdBy: "u",
  closedAt:
    overrides.status && overrides.status !== "open"
      ? "2026-10-18T12:00:00Z"
      : null,
  closedBy: overrides.status && overrides.status !== "open" ? "u" : null,
  sale: null,
  settlement: null,
  ...overrides,
});
function setup() {
  const context = { identity: "A", scopeKey: "a".repeat(64) };
  const cache = new PosCache();
  cache.bind("A");
  const uuid = vi.fn(() => "uuid-1");
  const client = createPosClient(() => context, { contractVersion: 2 });
  return {
    context,
    cache,
    uuid,
    commands: new MeasuredOrderCommands(client, cache, {
      uuid,
      historyStatus: "active",
    }),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
afterEach(() => vi.unstubAllGlobals());

describe("measured order commands through captured V2 transport", () => {
  it.each(["closed", "voided"] as const)(
    "recovers a lost create as current %s with exactly the frozen body/key/headers",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockRejectedValueOnce(new TypeError("lost"))
        .mockResolvedValueOnce(Response.json(order({ status, version: 3 })));
      vi.stubGlobal("fetch", fetcher);
      const { commands, uuid, cache } = setup();
      const input = structuredClone(draft);
      expect((await commands.create(input)).status).toBe("uncertain");
      input.items[0].quantity = "500";
      await commands.create(input);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(uuid).toHaveBeenCalledTimes(1);
      expect((await commands.retry()).status).toBe("confirmed");
      const calls = fetcher.mock.calls;
      expect(calls[0][1]).toEqual(calls[1][1]);
      const body = JSON.parse(calls[1][1]!.body as string);
      expect(body).toMatchObject({
        createRequestId: "uuid-1",
        items: [{ quantity: "0.125" }],
      });
      expect(new Headers(calls[1][1]?.headers).get("x-pos-contract")).toBe("2");
      expect(new Headers(calls[1][1]?.headers).get("x-backoffice-scope")).toBe(
        "a".repeat(64),
      );
      expect(cache.peek<PosOrderV2>(detailKey("o"))?.status).toBe(status);
      expect(calls.map(([url]) => url)).toEqual([
        "/api/modules/pos/orders",
        "/api/modules/pos/orders",
      ]);
      const state = commands.getSnapshot();
      if (state.status === "confirmed") {
        expect(Object.isFrozen(state.intent.body)).toBe(true);
        expect(Object.isFrozen(state.intent.body.items[0])).toBe(true);
      }
    },
  );
  it("shares the pending promise and does not replace it on double click", async () => {
    const response = deferred<Response>();
    const fetcher = vi.fn<typeof fetch>(() => response.promise);
    vi.stubGlobal("fetch", fetcher);
    const { commands } = setup();
    const first = commands.create(draft);
    const second = commands.create({ ...draft, note: "different" });
    expect(first).toBe(second);
    expect(fetcher).toHaveBeenCalledTimes(1);
    response.resolve(Response.json(order()));
    await first;
    expect(
      JSON.parse(fetcher.mock.calls[0][1]!.body as string).note,
    ).toBeNull();
  });
  it.each([
    "version_conflict",
    "catalog_revision_conflict",
    "catalog_changed",
    "unknown_conflict",
  ])("keeps full PUT %s for deliberate review with no retry", async (code) => {
    const payload = {
      code,
      order: order({ version: 8 }),
      products: [{ id: "p", catalogRevision: "9", extra: { preserved: true } }],
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(payload, { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    const { commands, uuid, cache } = setup();
    const update: PosUpdateV2 = {
      ...structuredClone(draft),
      orderLabel: "Pedido",
      version: 2,
    };
    const result = await commands.update("o", update);
    update.version = 3;
    update.items[0].quantity = "9";
    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect((result.error as PosError).payload).toEqual(payload);
      expect(result.intent.body).toMatchObject({
        version: 2,
        items: [{ quantity: "0.125" }],
      });
    }
    await commands.retry();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(uuid).not.toHaveBeenCalled();
    expect(cache.peek(detailKey("o"))).toBeNull();
    expect(
      JSON.parse(fetcher.mock.calls[0][1]!.body as string),
    ).not.toHaveProperty("createRequestId");
  });
  it.each([403, 412, 422, 408, 500, 503])(
    "classifies HTTP %s without retry",
    async (status) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ code: "failed" }, { status }));
      vi.stubGlobal("fetch", fetcher);
      const result = await setup().commands.create(draft);
      expect(result.status).toBe(
        status === 408 || status >= 500 ? "uncertain" : "rejected",
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["not-json", "{}", "null"])(
    "keeps successful unusable response %s uncertain",
    async (body) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response(body, { status: 201 })),
      );
      expect((await setup().commands.create(draft)).status).toBe("uncertain");
    },
  );
  it("rejects retry under B before fetch and never writes A into B", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("lost"));
    vi.stubGlobal("fetch", fetcher);
    const { commands, context, cache } = setup();
    await commands.create(draft);
    context.identity = "B";
    expect((await commands.retry()).status).toBe("retired");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.peek(detailKey("o"))).toBeNull();
    await commands.create(draft);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(["scope", "cache", "retire"])(
    "discards a late response after %s withdrawal",
    async (kind) => {
      const response = deferred<Response>();
      const fetcher = vi.fn<typeof fetch>(() => response.promise);
      vi.stubGlobal("fetch", fetcher);
      const { commands, context, cache } = setup();
      const pending = commands.create(draft);
      if (kind === "scope") context.identity = "B";
      else if (kind === "cache") cache.bind("B");
      else commands.retire();
      response.resolve(Response.json(order()));
      expect((await pending).status).toBe("retired");
      expect(cache.peek(detailKey("o"))).toBeNull();
      await commands.retry();
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([401, 409])(
    "retires authentication/context invalidation %s",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn<typeof fetch>()
          .mockResolvedValue(
            Response.json({ code: "backoffice_context_changed" }, { status }),
          ),
      );
      expect((await setup().commands.create(draft)).status).toBe("retired");
    },
  );
  it("publishes to subscribers and success does no extra GET even with history", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(order()));
    vi.stubGlobal("fetch", fetcher);
    const { commands, cache } = setup();
    cache.put(historyKey, { open: [], closedToday: [] });
    const observed: string[] = [];
    const unsubscribe = commands.subscribe(() =>
      observed.push(commands.getSnapshot().status),
    );
    await commands.create(draft);
    unsubscribe();
    commands.retire();
    expect(observed).toEqual(["pending", "confirmed"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

it("a lost PUT retries its frozen version and reports current full order conflict, never inferred success", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError("lost"))
    .mockResolvedValueOnce(
      Response.json(
        { code: "version_conflict", order: order({ version: 3 }) },
        { status: 409 },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const { commands } = setup();
  const input: PosUpdateV2 = {
    ...structuredClone(draft),
    orderLabel: "Pedido",
    version: 2,
  };
  expect((await commands.update("o", input)).status).toBe("uncertain");
  input.version = 3;
  const result = await commands.retry();
  expect(result.status).toBe("conflict");
  if (result.status === "conflict")
    expect((result.error as PosError).payload.order).toEqual(
      order({ version: 3 }),
    );
  expect(fetcher.mock.calls[0][1]).toEqual(fetcher.mock.calls[1][1]);
});
it.each(["scope", "retire"])(
  "captures before notifying pending subscribers; %s withdrawal sends nothing",
  async (kind) => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const { commands, context } = setup();
    commands.subscribe(() => {
      if (commands.getSnapshot().status !== "pending") return;
      if (kind === "scope") context.identity = "B";
      else commands.retire();
    });
    expect((await commands.create(draft)).status).toBe("retired");
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it("a successful partial DTO cannot confirm or populate cache", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ contractVersion: 2, id: "o", version: 1, items: [] }),
      ),
  );
  const { commands, cache } = setup();
  expect((await commands.create(draft)).status).toBe("uncertain");
  expect(cache.peek(detailKey("o"))).toBeNull();
});
it("reports a newer cached summary for explicit review rather than confirming an older detail", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(order({ version: 2 })));
  vi.stubGlobal("fetch", fetcher);
  const { commands, cache } = setup();
  const summary = { ...order({ version: 9 }), lineCount: 0, saleTotal: null };
  cache.put(historyKey, { open: [summary], closedToday: [] });
  const result = await commands.create(draft);
  expect(result.status).toBe("conflict");
  if (result.status === "conflict") {
    expect((result.error as PosError).code).toBe("cache_revision_ahead");
    expect((result.error as PosError).payload).toEqual({
      receivedOrder: order({ version: 2 }),
      summary,
    });
    expect((result.error as PosError).payload).not.toHaveProperty("order");
  }
  expect(cache.peek(detailKey("o"))).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each(["closed", "voided"] as const)(
  "reports review without an authoritative detail for same-version %s summary",
  async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(order({ version: 3 })));
    vi.stubGlobal("fetch", fetcher);
    const { commands, cache } = setup();
    const summary = {
      ...order({ version: 3, status }),
      lineCount: 0,
      saleTotal: status === "closed" ? "2.50" : null,
    };
    cache.put(historyKey, { open: [], closedToday: [summary] });
    const result = await commands.create(draft);
    expect(result.status).toBe("conflict");
    if (result.status === "conflict") {
      expect((result.error as PosError).code).toBe("cache_revision_ahead");
      expect((result.error as PosError).payload).toEqual({
        receivedOrder: order({ version: 3 }),
        summary,
      });
      expect((result.error as PosError).order).toBeUndefined();
    }
    expect(cache.peek(detailKey("o"))).toBeNull();
    expect(cache.peek<PosOrderV2>(detailKey("o"), true)?.status).toBe("open");
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
