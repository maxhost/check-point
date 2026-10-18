import { afterEach, describe, expect, it, vi } from "vitest";
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
