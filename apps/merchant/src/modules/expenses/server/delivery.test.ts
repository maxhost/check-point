import { beforeEach, describe, expect, it, vi } from "vitest";
import { matchRoute } from "../../route-table";
import { ModuleError } from "../../errors";

const h = vi.hoisted(() => ({
  after: vi.fn(),
  retry: vi.fn(),
  callbacks: [] as (() => Promise<void>)[],
  createExpenses: vi.fn(),
  mutateExpense: vi.fn(),
  getContext: vi.fn(),
  listConcepts: vi.fn(),
  listExpenses: vi.fn(),
  buildDraft: vi.fn(),
  buildPhotoDraft: vi.fn(),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: h.after,
}));
vi.mock("../../../server/module-events", () => ({
  retryModuleEvents: h.retry,
}));
vi.mock("./writers", () => h);
vi.mock("./queries", () => h);
vi.mock("../draft", () => h);
import { routes } from "./routes";

const business = {
  id: "authenticated-business",
  currencyCode: "COP",
  status: "active",
};
const payload = {
  operationId: "operation",
  businessId: "untrusted-business",
  force: true,
};
const saved = {
  id: "expense",
  amountMinor: "12000",
  currencyCode: "COP",
  minorUnit: 0,
};
const scope = {
  businessId: business.id,
  eventTypes: ["expense.recorded", "expense.updated", "expense.deleted"],
  subscriberIds: ["core.analytics"],
  budgetMs: 20000,
  batchSize: 50,
};
const writes = [
  {
    method: "POST",
    path: "entries",
    service: "createExpenses",
    dto: { expenses: [saved] },
    status: 201,
  },
  {
    method: "PUT",
    path: "entries/expense",
    service: "mutateExpense",
    dto: { expense: saved },
    status: 200,
  },
  {
    method: "DELETE",
    path: "entries/expense",
    service: "mutateExpense",
    dto: { expense: { ...saved, deletedAt: "2026-10-17T18:00:00Z" } },
    status: 200,
  },
] as const;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function request(method: string, path: string, body?: unknown) {
  const found = matchRoute(routes, method, path.split("/"));
  expect(found.kind).toBe("found");
  if (found.kind !== "found") throw new Error("Missing expenses route");
  expect(found.route.permission).toBe("expenses");
  return found.route.handler({
    business,
    userId: "authenticated-user",
    params: found.params,
    request: new Request(`http://localhost/api/modules/expenses/${path}`, {
      method,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  h.callbacks.length = 0;
  h.after.mockImplementation((work: () => Promise<void>) => {
    h.callbacks.push(work);
  });
  h.retry.mockResolvedValue({ claimed: 0, applied: 0, pending: 0, failed: 0 });
  h.createExpenses.mockResolvedValue(writes[0].dto);
  h.mutateExpense.mockResolvedValue(writes[1].dto);
});

describe("post-commit acceleration of expenses through the real route table", () => {
  it.each(writes)(
    "$method waits for the writer, then registers one awaitable scoped callback without changing the response",
    async ({ method, path, service, dto, status }) => {
      const entered = deferred<void>(),
        committed = deferred<typeof dto>();
      h[service].mockImplementation(() => {
        entered.resolve();
        return committed.promise;
      });
      const response = request(method, path, payload);
      await entered.promise;
      expect(h.after).not.toHaveBeenCalled();
      expect(h.retry).not.toHaveBeenCalled();
      committed.resolve(dto);
      const result = await response;
      expect(result.status).toBe(status);
      expect(await result.json()).toEqual(dto);
      expect(h.after).toHaveBeenCalledTimes(1);
      expect(h.retry).not.toHaveBeenCalled();
      expect(h.callbacks).toHaveLength(1);
      await expect(h.callbacks[0]()).resolves.toBeUndefined();
      expect(h.retry).toHaveBeenCalledExactlyOnceWith(scope);
      if (method === "POST")
        expect(h.createExpenses).toHaveBeenCalledWith(
          business.id,
          "authenticated-user",
          payload,
        );
      else
        expect(h.mutateExpense).toHaveBeenCalledWith(
          business.id,
          "authenticated-user",
          "expense",
          method === "PUT" ? "updated" : "deleted",
          payload,
        );
    },
  );

  it("registers one bounded attempt for a thirty-line batch, including an idempotent writer response", async () => {
    const dto = {
      expenses: Array.from({ length: 30 }, (_, i) => ({
        ...saved,
        id: `expense-${i}`,
      })),
    };
    const batch = {
      ...payload,
      lines: Array.from({ length: 30 }, () => ({ amountMinor: "12000" })),
    };
    h.createExpenses.mockResolvedValue(dto);
    for (let n = 0; n < 2; n++) {
      const response = await request("POST", "entries", batch);
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual(dto);
      expect(h.after).toHaveBeenCalledTimes(n + 1);
    }
    expect(h.callbacks).toHaveLength(2);
    for (const work of h.callbacks) await work();
    expect(h.retry).toHaveBeenCalledTimes(2);
    for (const [options] of h.retry.mock.calls) expect(options).toEqual(scope);
  });

  it.each(writes)(
    "$method does not schedule a failed writer or replace its ModuleError",
    async ({ method, path, service }) => {
      const conflict = new ModuleError(
        409,
        "revision_conflict",
        "El gasto cambió.",
      );
      h[service].mockRejectedValue(conflict);
      await expect(request(method, path, payload)).rejects.toBe(conflict);
      expect(h.after).not.toHaveBeenCalled();
      expect(h.retry).not.toHaveBeenCalled();
    },
  );

  it.each(writes)(
    "$method preserves the existing503 mapping for an unexpected writer failure, without dispatch",
    async ({ method, path, service }) => {
      h[service].mockImplementation(() => {
        throw new Error("writer failed before commit");
      });
      await expect(request(method, path, payload)).rejects.toMatchObject({
        status: 503,
        code: "expenses_unavailable",
      });
      expect(h.after).not.toHaveBeenCalled();
      expect(h.retry).not.toHaveBeenCalled();
    },
  );

  it("does not schedule invalid JSON, GETs, or either draft route", async () => {
    await expect(request("POST", "entries", [])).rejects.toMatchObject({
      status: 400,
      code: "invalid_body",
    });
    expect(h.createExpenses).not.toHaveBeenCalled();
    h.getContext.mockResolvedValue({ currencyCode: "COP" });
    h.listConcepts.mockResolvedValue([]);
    h.listExpenses.mockResolvedValue([]);
    h.buildDraft.mockResolvedValue({ draft: "text" });
    h.buildPhotoDraft.mockResolvedValue({ draft: "photo" });
    for (const [method, path] of [
      ["GET", "context"],
      ["GET", "concepts"],
      ["GET", "entries"],
      ["POST", "entries/draft"],
      ["POST", "entries/draft-photo"],
    ]) {
      expect(
        (await request(method, path, method === "POST" ? payload : undefined))
          .status,
      ).toBe(200);
    }
    expect(h.after).not.toHaveBeenCalled();
    expect(h.retry).not.toHaveBeenCalled();
  });

  it.each(["sync", "async"])(
    "swallows a %s retry failure inside the awaitable after callback",
    async (failure) => {
      if (failure === "sync")
        h.retry.mockImplementation(() => {
          throw new Error("retry sync failure");
        });
      else h.retry.mockRejectedValue(new Error("retry async failure"));
      const result = await request("POST", "entries", payload);
      await expect(h.callbacks[0]()).resolves.toBeUndefined();
      expect(result.status).toBe(201);
      expect(await result.json()).toEqual(writes[0].dto);
      expect(h.retry).toHaveBeenCalledExactlyOnceWith(scope);
    },
  );

  it("falls back outside Next and responds while retry is still unresolved", async () => {
    h.after.mockImplementation(() => {
      throw new Error("No Next request context");
    });
    const delivery = deferred<unknown>();
    let delivered = false;
    h.retry.mockImplementation(async () => {
      await delivery.promise;
      delivered = true;
    });
    const result = await request("POST", "entries", payload);
    expect(delivered).toBe(false);
    expect(result.status).toBe(201);
    expect(await result.json()).toEqual(writes[0].dto);
    expect(h.after).toHaveBeenCalledTimes(1);
    expect(h.retry).toHaveBeenCalledExactlyOnceWith(scope);
    delivery.resolve(undefined);
    await Promise.resolve();
    expect(delivered).toBe(true);
  });

  it.each(["sync", "async"])(
    "keeps the committed response when after throws and fallback retry fails %s, with no unhandled rejection",
    async (failure) => {
      h.after.mockImplementation(() => {
        throw new Error("after unavailable");
      });
      if (failure === "sync")
        h.retry.mockImplementation(() => {
          throw new Error("fallback sync failure");
        });
      else h.retry.mockRejectedValue(new Error("fallback async failure"));
      const unhandled = vi.fn();
      process.on("unhandledRejection", unhandled);
      try {
        const result = await request("POST", "entries", payload);
        expect(result.status).toBe(201);
        expect(await result.json()).toEqual(writes[0].dto);
        expect(h.retry).toHaveBeenCalledExactlyOnceWith(scope);
        await new Promise<void>((resolve) => setImmediate(resolve));
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off("unhandledRejection", unhandled);
      }
    },
  );
});
