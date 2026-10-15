import type { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ClientStub = EventEmitter & { release: ReturnType<typeof vi.fn> };
type PoolStub = EventEmitter & {
  options: { connectionString: string; connectionTimeoutMillis?: number };
  client: ClientStub;
};
const fake = vi.hoisted(() => ({
  pools: [] as PoolStub[],
  transaction: vi.fn(),
}));
vi.mock("@neondatabase/serverless", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    neon: vi.fn(),
    neonConfig: {},
    Pool: class extends EventEmitter {
      client = Object.assign(new EventEmitter(), { release: vi.fn() });
      constructor(public options: PoolStub["options"]) {
        super();
        fake.pools.push(this);
      }
      async connect() {
        return this.client;
      }
    },
  };
});
vi.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: () => ({ transaction: fake.transaction }),
}));
vi.mock("./schema", () => ({}));

// Entire driver is mocked: no endpoint, query or credential is used outside this fixture.
const fixtureUrl = "postgresql://fixture-user:fixture-secret@unit.invalid/unit";
describe("pool idle errors and active transaction failures", () => {
  beforeEach(() => {
    vi.resetModules();
    fake.pools.length = 0;
    fake.transaction.mockReset();
    fake.transaction.mockImplementation(async (work: () => Promise<unknown>) =>
      work(),
    );
    vi.stubEnv("DATABASE_URL", fixtureUrl);
    vi.stubEnv("NODE_ENV", "test");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("handles idle errors for default and bounded pools without throwing or logging sensitive context", async () => {
    const logs = [
      vi.spyOn(console, "error").mockImplementation(() => {}),
      vi.spyOn(console, "warn").mockImplementation(() => {}),
      vi.spyOn(console, "log").mockImplementation(() => {}),
      vi.spyOn(console, "info").mockImplementation(() => {}),
      vi.spyOn(console, "debug").mockImplementation(() => {}),
    ];
    const { withDbTransaction } = await import("./client");
    expect(await withDbTransaction(async () => "default")).toBe("default");
    expect(
      await withDbTransaction(async () => "bounded", {
        connectionTimeoutMs: 2000,
      }),
    ).toBe("bounded");
    expect(fake.pools.map((pool) => pool.options)).toEqual([
      { connectionString: fixtureUrl, connectionTimeoutMillis: undefined },
      { connectionString: fixtureUrl, connectionTimeoutMillis: 1000 },
    ]);
    const context = {
      connectionString: fixtureUrl,
      password: "fixture-client-secret",
    };
    const error = Object.assign(new Error(`idle disconnect: ${fixtureUrl}`), {
      context,
    });
    for (const pool of fake.pools) {
      expect(pool.listenerCount("error")).toBe(1);
      expect(() => pool.emit("error", error, context)).not.toThrow();
    }
    for (const log of logs) expect(log).not.toHaveBeenCalled();
  });

  it("propagates the exact active query error for both pool kinds and retires a failed bounded client", async () => {
    const { withDbTransaction } = await import("./client");
    const error = new Error("active query rejected");
    const work = async () => {
      throw error;
    };
    await expect(withDbTransaction(work)).rejects.toBe(error);
    await expect(
      withDbTransaction(work, { connectionTimeoutMs: 500 }),
    ).rejects.toBe(error);
    expect(fake.pools[1].client.release).toHaveBeenCalledExactlyOnceWith(true);
    expect(fake.pools[1].client.listenerCount("error")).toBe(0);
  });
});
