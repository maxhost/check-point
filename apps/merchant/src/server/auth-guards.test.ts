import { afterEach, describe, expect, it, vi } from "vitest";
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { loginNotice } from "../app/login/login-notice";

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
/** Every `db.delete(table).where(cond)` the guard issued, in order. */
let deletes: Array<{ table: unknown; where: SQL }> = [];

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
  chain.delete = (table: unknown) => ({
    where: async (where: SQL) => {
      deletes.push({ table, where });
    },
  });
  return { getDb: () => chain };
});

import {
  requireBackofficeSession,
  requireOwner,
  STAFF_DISABLED,
} from "./auth-guards";
import { sessions } from "./schema";

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
    deletes = [];
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

  // ADR 0055 / spec 0057: the bounce says why, and leaves no live session behind.
  it("disabled membership → /login with the reason, and revokes the session first", async () => {
    sessionValue = { user: { id: "u1", name: "Ana" } };
    membershipRow = { ...owner, role: "staff", status: "disabled" };

    expect(await destinationOf(requireBackofficeSession)).toBe(
      "/login?e=staff_disabled",
    );

    // The redirect throws NEXT_REDIRECT: if the revocation moved after it, or was
    // dropped, nothing would have been recorded by the time we get here.
    expect(deletes).toHaveLength(1);
    expect(deletes[0].table).toBe(sessions);
    const { sql, params } = new PgDialect().sqlToQuery(deletes[0].where);
    expect(sql).toContain('"user_id"');
    expect(params).toEqual(["u1"]);
  });

  // Pins the guard's reason code to the copy the login shows; they live in two files.
  it("the reason the guard emits is the one the login can translate", () => {
    expect(STAFF_DISABLED).toBe("staff_disabled");
    expect(loginNotice(STAFF_DISABLED)).toBe("Miembro del staff desactivado");
  });

  it("active staff passes the session guard but requireOwner sends it to the counter", async () => {
    sessionValue = { user: { id: "u1", name: "Ana" } };
    membershipRow = { ...owner, role: "staff", status: "active" };
    const ctx = await requireBackofficeSession();
    expect(ctx.membership).toEqual({ role: "staff", status: "active" });
    expect(deletes).toEqual([]);
    expect(await destinationOf(requireOwner)).toBe("/backoffice/counter");
    expect(deletes).toEqual([]);
  });

  it("active owner reaches an owner-only page", async () => {
    sessionValue = { user: { id: "u1", name: "Ana" } };
    membershipRow = { ...owner };
    const ctx = await requireOwner();
    expect(ctx.membership.role).toBe("owner");
    expect(ctx.business.id).toBe("b1");
    expect(ctx.userName).toBe("Ana");
    expect(deletes).toEqual([]);
  });
});
