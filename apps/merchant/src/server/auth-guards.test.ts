import { afterEach, describe, expect, it, vi } from "vitest";

// Redirect throws a tagged error so we can assert the destination without a real router.
class Redirected extends Error {
  constructor(readonly to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

let sessionValue: { user: { id: string; name: string } } | null = null;
let membershipRow: Record<string, unknown> | undefined;

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: { getSession: async () => sessionValue },
  }),
}));

vi.mock("./db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "innerJoin", "where", "orderBy"]) {
    chain[m] = () => chain;
  }
  chain.limit = () => Promise.resolve(membershipRow ? [membershipRow] : []);
  return { getDb: () => chain };
});

import { requireBackofficeSession, requireOwner } from "./auth-guards";

const owner = {
  id: "b1",
  name: "Bar",
  currencyCode: "USD",
  timezone: "America/Guayaquil",
  role: "owner",
  status: "active",
};

async function destinationOf(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Redirected) return error.to;
    throw error;
  }
  return "<no-redirect>";
}

describe("backoffice guards by role (ADR 0044)", () => {
  afterEach(() => {
    sessionValue = null;
    membershipRow = undefined;
  });

  it("no session → /login", async () => {
    sessionValue = null;
    expect(await destinationOf(requireBackofficeSession)).toBe("/login");
  });

  it("session but no membership → /onboarding", async () => {
    sessionValue = { user: { id: "u1", name: "Ana" } };
    membershipRow = undefined;
    expect(await destinationOf(requireBackofficeSession)).toBe("/onboarding");
  });

  it("disabled membership → /login", async () => {
    sessionValue = { user: { id: "u1", name: "Ana" } };
    membershipRow = { ...owner, role: "staff", status: "disabled" };
    expect(await destinationOf(requireBackofficeSession)).toBe("/login");
  });

  it("active staff passes the session guard but requireOwner sends it to the counter", async () => {
    sessionValue = { user: { id: "u1", name: "Ana" } };
    membershipRow = { ...owner, role: "staff", status: "active" };
    const ctx = await requireBackofficeSession();
    expect(ctx.membership).toEqual({ role: "staff", status: "active" });
    expect(await destinationOf(requireOwner)).toBe("/backoffice/counter");
  });

  it("active owner reaches an owner-only page", async () => {
    sessionValue = { user: { id: "u1", name: "Ana" } };
    membershipRow = { ...owner };
    const ctx = await requireOwner();
    expect(ctx.membership.role).toBe("owner");
    expect(ctx.business.id).toBe("b1");
    expect(ctx.userName).toBe("Ana");
  });
});
