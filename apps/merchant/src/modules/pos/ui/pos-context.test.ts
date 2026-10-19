import { afterEach, describe, expect, it, vi } from "vitest";
import { PosError } from "./pos-types";
import { createPosClient, DiscardedPosIntent } from "./pos-context";

afterEach(() => vi.unstubAllGlobals());
const deferred = () => {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
describe("POS intention transport", () => {
  it("captures scope before awaiting and discards A without retiring B", async () => {
    const response = deferred();
    const retire = vi.fn();
    let identity = "A";
    const fetcher = vi.fn<typeof fetch>(() => response.promise);
    vi.stubGlobal("fetch", fetcher);
    const client = createPosClient(() => ({
      identity,
      scopeKey: identity.toLowerCase().repeat(64),
      retire,
    }));
    const pending = client.request("/api/modules/pos/orders");
    expect(
      (fetcher.mock.calls[0][1]?.headers as Record<string, string>)[
        "X-Backoffice-Scope"
      ],
    ).toBe("a".repeat(64));
    identity = "B";
    response.resolve(
      Response.json({ code: "backoffice_context_changed" }, { status: 409 }),
    );
    await expect(pending).rejects.toBeInstanceOf(DiscardedPosIntent);
    expect(retire).not.toHaveBeenCalled();
  });
  it.each([401, 409])(
    "retires current scope on %s exactly through the provider",
    async (status) => {
      const retire = vi.fn();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json(
            {
              code:
                status === 409 ? "backoffice_context_changed" : "unauthorized",
            },
            { status },
          ),
        ),
      );
      const client = createPosClient(() => ({
        identity: "A",
        scopeKey: "a".repeat(64),
        retire,
      }));
      await expect(
        client.request("/api/modules/pos/ticket-settings"),
      ).rejects.toMatchObject({ status });
      expect(retire).toHaveBeenCalledOnce();
    },
  );
  it.each([402, 403, 409])(
    "preserves non-scope restriction/conflict %s",
    async (status) => {
      const retire = vi.fn();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ code: "version_conflict" }, { status }),
        ),
      );
      const client = createPosClient(() => ({
        identity: "A",
        scopeKey: "a".repeat(64),
        retire,
      }));
      await expect(
        client.request("/api/modules/pos/orders"),
      ).rejects.toMatchObject({ status, code: "version_conflict" });
      expect(retire).not.toHaveBeenCalled();
    },
  );
  it("never falls back to unscoped transport after withdrawal", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const client = createPosClient(() => ({ identity: null }));
    await expect(
      client.request("/api/modules/pos/orders"),
    ).rejects.toBeInstanceOf(DiscardedPosIntent);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("reuses frozen transport and body, rejecting a retry after scope change", async () => {
    let identity = "A";
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetcher);
    const request = createPosClient(() => ({
      identity,
      scopeKey: identity.toLowerCase().repeat(64),
    })).capture();
    const body = Object.freeze({ clientRequestId: "same", version: 2 });
    await request("/close", "POST", body);
    await request("/close", "POST", body);
    expect(fetcher.mock.calls[0][1]).toEqual(fetcher.mock.calls[1][1]);
    identity = "B";
    await expect(request("/close", "POST", body)).rejects.toBeInstanceOf(
      DiscardedPosIntent,
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("POS contract opt-in", () => {
  it.each([undefined, 1, 2] as const)(
    "uses the same transport with version %s",
    async (contractVersion) => {
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json({ ok: true }),
      );
      vi.stubGlobal("fetch", fetcher);
      const client = createPosClient(
        () => ({ identity: "A", scopeKey: "a".repeat(64) }),
        { contractVersion },
      );
      const body = {
        clientRequestId: "same",
        quantity: "1.250",
        unitPrice: "0.000001",
      };
      await client.request("/api/modules/pos/orders", "POST", body);
      expect(fetcher).toHaveBeenCalledOnce();
      const [url, init] = fetcher.mock.calls[0];
      expect(url).toBe("/api/modules/pos/orders");
      expect(init).toMatchObject({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const headers = new Headers(init?.headers);
      expect(headers.get("x-pos-contract")).toBe(
        contractVersion === 2 ? "2" : null,
      );
      expect(headers.get("x-backoffice-scope")).toBe("a".repeat(64));
      expect(headers.get("content-type")).toBe("application/json");
      if (contractVersion !== 2)
        expect(init?.headers).toEqual({
          "content-type": "application/json",
          "X-Backoffice-Scope": "a".repeat(64),
        });
    },
  );

  it("freezes version and copied scope for captured retries before await", async () => {
    const response = deferred();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(response.promise)
      .mockImplementation(async () => Response.json({ ok: true }));
    vi.stubGlobal("fetch", fetcher);
    const context = { identity: "A", scopeKey: "a".repeat(64) };
    const options: { contractVersion: 1 | 2 } = { contractVersion: 2 };
    const client = createPosClient(() => context, options);
    const captured = client.capture();
    options.contractVersion = 1;
    context.scopeKey = "b".repeat(64);
    const body = Object.freeze({ clientRequestId: "same", quantity: "1.250" });
    const pending = captured("/api/modules/pos/orders", "POST", body);
    response.resolve(Response.json({ ok: true }));
    await pending;
    await captured("/api/modules/pos/orders", "POST", body);
    expect(fetcher.mock.calls[0][1]).toEqual(fetcher.mock.calls[1][1]);
    const headers = new Headers(fetcher.mock.calls[1][1]?.headers);
    expect(headers.get("x-pos-contract")).toBe("2");
    expect(headers.get("x-backoffice-scope")).toBe("a".repeat(64));
    await client.request("/api/modules/pos/orders");
    expect(
      new Headers(fetcher.mock.calls[2][1]?.headers).get("x-pos-contract"),
    ).toBeNull();
    context.identity = "B";
    await expect(captured("/api/modules/pos/orders")).rejects.toBeInstanceOf(
      DiscardedPosIntent,
    );
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it.each([200, 401, 403, 409])(
    "discards late V2 response %s without retiring B",
    async (status) => {
      const response = deferred();
      const retire = vi.fn();
      let identity = "A";
      const fetcher = vi.fn<typeof fetch>(() => response.promise);
      vi.stubGlobal("fetch", fetcher);
      const client = createPosClient(
        () => ({
          identity,
          scopeKey: identity.toLowerCase().repeat(64),
          retire,
        }),
        { contractVersion: 2 },
      );
      const pending = client.request("/api/modules/pos/orders");
      identity = "B";
      response.resolve(
        Response.json({ code: "backoffice_context_changed" }, { status }),
      );
      await expect(pending).rejects.toBeInstanceOf(DiscardedPosIntent);
      expect(retire).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it.each([401, 409])(
    "retires current V2 intention once on scope/auth %s",
    async (status) => {
      const retire = vi.fn();
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json(
          {
            code:
              status === 401 ? "unauthorized" : "backoffice_context_changed",
          },
          { status },
        ),
      );
      vi.stubGlobal("fetch", fetcher);
      const client = createPosClient(
        () => ({ identity: "A", scopeKey: "a".repeat(64), retire }),
        { contractVersion: 2 },
      );
      await expect(
        client.request("/api/modules/pos/orders"),
      ).rejects.toMatchObject({ status });
      expect(retire).toHaveBeenCalledOnce();
      expect(fetcher).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [402, "payment_required"],
    [403, "forbidden"],
    [409, "version_conflict"],
    [409, "catalog_changed"],
    [409, "pos_client_upgrade_required"],
  ] as const)(
    "preserves authorized payload on %s/%s without replay or downgrade",
    async (status, code) => {
      const payload = {
        error: "Fixture rejection",
        code,
        openCount: 3,
        products: [
          {
            id: "product",
            price: "0.000001",
            revision: "7",
            measure: { kind: "mass", pricingUnit: "g" },
          },
        ],
        order: {
          id: "order",
          version: 3,
          items: [
            {
              lineId: "line",
              quantity: "1.250",
              unitPrice: "0.000001",
              lineTotal: "0.00000125",
            },
          ],
          total: "0.00000125",
        },
        metadata: { revision: "7", reason: "review" },
      };
      const retire = vi.fn();
      const fetcher = vi.fn<typeof fetch>(async () =>
        Response.json(payload, { status }),
      );
      vi.stubGlobal("fetch", fetcher);
      const client = createPosClient(
        () => ({ identity: "A", scopeKey: "a".repeat(64), retire }),
        { contractVersion: 2 },
      );
      const error = await client
        .request("/api/modules/pos/orders", "PUT", { quantity: "1.250" })
        .catch((failure: unknown) => failure);
      expect(error).toBeInstanceOf(PosError);
      expect(error).toMatchObject({
        message: payload.error,
        status,
        code,
        openCount: 3,
        order: payload.order,
        payload,
      });
      expect(retire).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledOnce();
      expect(
        new Headers(fetcher.mock.calls[0][1]?.headers).get("x-pos-contract"),
      ).toBe("2");
    },
  );

  it("preserves the legacy client fetch shape without a provider or opt-in", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetcher);
    await createPosClient(() => ({ identity: "legacy" })).request(
      "/api/modules/pos/orders",
    );
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/modules/pos/orders", {
      method: "GET",
      cache: "no-store",
    });
  });

  it("preserves a legacy conflict order and its numeric quantity", async () => {
    const order = {
      id: "order",
      version: 2,
      items: [{ quantity: 2, unitPrice: "1.00" }],
      total: "2.00",
    };
    const payload = {
      error: "Fixture conflict",
      code: "version_conflict",
      order,
    };
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(payload, { status: 409 }),
    );
    vi.stubGlobal("fetch", fetcher);
    const error = await createPosClient(() => ({ identity: "legacy" }))
      .request("/api/modules/pos/orders")
      .catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(PosError);
    expect(error).toMatchObject({
      order,
      payload,
      status: 409,
      code: "version_conflict",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps the legacy PosError constructor and order properties", () => {
    const error = new PosError("legacy", "conflict", undefined, 2, 409);
    expect(error).toMatchObject({
      message: "legacy",
      code: "conflict",
      openCount: 2,
      status: 409,
      payload: {},
    });
  });
});
