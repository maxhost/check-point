import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Unit coverage for the name refresh of the re-enroll (ADR 0050 / spec 0053).
 *
 * The DB effect itself is proven against a real Neon branch
 * (`consumer-enrollment-name.neon.integration.test.ts`); what is checked HERE is the
 * shape of the value `enroll()` hands back — the 201, the Wallet pass and the portal
 * all read the name off `result.account`, so returning the pre-update row would keep
 * showing the stale name even with the UPDATE landing correctly.
 *
 * It also pins the ORDER: the refresh must run after the membership insert, so an enroll
 * that ends in 409 issues no UPDATE at all (a rejected operation leaves no effects).
 *
 * The fake db is a recording chain: it answers `select … limit` from a per-table queue
 * and resolves `update … returning` by merging the `set` payload onto the stored row,
 * which is what Postgres does. Every statement is recorded so the test can assert that
 * the update targets `consumer_account`, carries ONLY the two name columns and happens
 * after the membership insert.
 */

type Row = Record<string, unknown>;
type Statement = { kind: string; table: string; payload?: Row };

const state = {
  // FIFO of results for `select … from(<table>) … limit(1)`, keyed by table name.
  reads: {} as Record<string, Row[][]>,
  // Rows the fake "stores", by id — an update returns the merge of row + set payload.
  rows: {} as Record<string, Row>,
  // When set, the account insert rejects with this pg error (race simulation).
  insertAccountError: null as { code: string } | null,
  // When set, the membership insert rejects with this pg error (409 already_member).
  insertMembershipError: null as { code: string } | null,
  statements: [] as Statement[],
};

function nextRead(table: string): Row[] {
  const queue = state.reads[table];
  if (!queue || queue.length === 0) return [];
  return queue.shift() as Row[];
}

vi.mock("../db", async () => {
  const { getTableName } = await import("drizzle-orm");
  type Pending = { table: string; payload?: Row };
  type Chain = {
    from(table: unknown): Chain;
    where(): Chain;
    set(payload: Row): Chain;
    values(payload: Row): Chain;
    limit(): Promise<Row[]>;
    returning(): Promise<Row[]>;
  };

  function builder(kind: string): Chain {
    const pending: Pending = { table: "?" };
    const chain: Chain = {
      from(table: unknown) {
        pending.table = getTableName(table as never);
        return chain;
      },
      where() {
        return chain;
      },
      set(payload: Row) {
        pending.payload = payload;
        return chain;
      },
      values(payload: Row) {
        pending.payload = payload;
        return chain;
      },
      limit() {
        state.statements.push({ kind, table: pending.table });
        return Promise.resolve(nextRead(pending.table));
      },
      returning() {
        state.statements.push({
          kind,
          table: pending.table,
          payload: pending.payload,
        });
        if (kind === "update") {
          const target = Object.values(state.rows).find(
            (row) => row.__table === pending.table,
          );
          if (!target) return Promise.resolve([]);
          const merged = { ...target, ...pending.payload };
          state.rows[target.id as string] = merged;
          return Promise.resolve([merged]);
        }
        if (pending.table === "consumer_account") {
          if (state.insertAccountError)
            return Promise.reject(state.insertAccountError);
          return Promise.resolve([
            { id: "acc-new", __table: "consumer_account", ...pending.payload },
          ]);
        }
        if (state.insertMembershipError)
          return Promise.reject(state.insertMembershipError);
        return Promise.resolve([
          {
            id: "membership-1",
            enrolledAt: new Date("2026-09-05T00:00:00Z"),
            ...pending.payload,
          },
        ]);
      },
    };
    return chain;
  }

  return {
    getDb: () => ({
      select: () => builder("select"),
      insert: (table: unknown) => builder("insert").from(table),
      update: (table: unknown) => builder("update").from(table),
      delete: (table: unknown) => builder("delete").from(table),
    }),
  };
});

import { enroll } from "./enrollment";

const PHONE = "+593998877654321";

function storedAccount(): Row {
  const row: Row = {
    id: "acc-existing",
    __table: "consumer_account",
    phoneE164: PHONE,
    phoneVerifiedAt: null,
    firstName: "Cliente iOS 4",
    lastName: "QA",
    countryIso: "EC",
    qrToken: "qr-token-original",
    webViewToken: "web-view-token-original",
    createdAt: new Date("2026-08-16T00:00:00Z"),
    updatedAt: new Date("2026-08-16T00:00:00Z"),
  };
  state.rows[row.id as string] = row;
  return row;
}

const INPUT = {
  firstName: "Logan",
  lastName: "Wolf",
  phoneE164: PHONE,
  countryIso: "AR",
};

function queueProgram() {
  state.reads.loyalty_program = [[{ id: "program-1", businessId: "biz-1" }]];
}

afterEach(() => {
  state.reads = {};
  state.rows = {};
  state.insertAccountError = null;
  state.insertMembershipError = null;
  state.statements = [];
});

describe("enroll() returns the refreshed name — spec 0053", () => {
  it("the account it hands back carries the name just typed, not the stored one", async () => {
    const existing = storedAccount();
    queueProgram();
    state.reads.consumer_account = [[existing]];

    const { account } = await enroll("program-1", INPUT);

    expect(account.firstName).toBe("Logan");
    expect(account.lastName).toBe("Wolf");
    // Same identity: it is a refresh of the existing account, not a new one.
    expect(account.id).toBe("acc-existing");
  });

  it("updates consumer_account with ONLY the two name columns (no phone/country/tokens)", async () => {
    const existing = storedAccount();
    queueProgram();
    state.reads.consumer_account = [[existing]];

    const { account } = await enroll("program-1", INPUT);

    const updates = state.statements.filter((s) => s.kind === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].table).toBe("consumer_account");
    expect(Object.keys(updates[0].payload ?? {}).sort()).toEqual([
      "firstName",
      "lastName",
      "updatedAt",
    ]);
    // Identity and credentials survive untouched in the returned row.
    expect(account.phoneE164).toBe(PHONE);
    expect(account.countryIso).toBe("EC");
    expect(account.qrToken).toBe("qr-token-original");
    expect(account.webViewToken).toBe("web-view-token-original");
    expect(account.phoneVerifiedAt).toBeNull();
  });

  it("the concurrent-race path (23505 on insert) also ends with the new name", async () => {
    const raced = storedAccount();
    queueProgram();
    // First read finds nothing → insert → 23505 (a concurrent enroll won) → re-read.
    state.reads.consumer_account = [[], [raced]];
    state.insertAccountError = { code: "23505" };

    const { account } = await enroll("program-1", INPUT);

    expect(account.id).toBe("acc-existing");
    expect(account.firstName).toBe("Logan");
    expect(account.lastName).toBe("Wolf");
    // The row created by the race keeps its own tokens; only the name was refreshed.
    expect(account.qrToken).toBe("qr-token-original");
    expect(state.statements.filter((s) => s.kind === "update")).toHaveLength(1);
  });

  it("a brand-new phone still inserts the account and never issues an update", async () => {
    queueProgram();
    state.reads.consumer_account = [[]];

    const { account, membership } = await enroll("program-1", INPUT);

    expect(state.statements.filter((s) => s.kind === "update")).toHaveLength(0);
    expect(account.firstName).toBe("Logan");
    expect(account.countryIso).toBe("AR");
    expect(account.qrToken).toBeTruthy();
    expect(membership.programId).toBe("program-1");
  });

  it("the refresh runs AFTER the membership insert, never before", async () => {
    const existing = storedAccount();
    queueProgram();
    state.reads.consumer_account = [[existing]];

    await enroll("program-1", INPUT);

    const writes = state.statements.filter((s) => s.kind !== "select");
    expect(writes.map((s) => `${s.kind} ${s.table}`)).toEqual([
      "insert program_membership",
      "update consumer_account",
    ]);
  });

  it("a 409 already_member writes NOTHING to the account", async () => {
    const existing = storedAccount();
    queueProgram();
    state.reads.consumer_account = [[existing]];
    state.insertMembershipError = { code: "23505" };

    await expect(enroll("program-1", INPUT)).rejects.toMatchObject({
      status: 409,
      code: "already_member",
    });

    expect(state.statements.filter((s) => s.kind === "update")).toHaveLength(0);
    // The stored row is the one the fake db would have mutated — still the old name.
    expect(state.rows["acc-existing"].firstName).toBe("Cliente iOS 4");
    expect(state.rows["acc-existing"].lastName).toBe("QA");
    expect(state.rows["acc-existing"].updatedAt).toEqual(
      new Date("2026-08-16T00:00:00Z"),
    );
  });

  it("the race path also leaves the account untouched when the alta ends in 409", async () => {
    const raced = storedAccount();
    queueProgram();
    state.reads.consumer_account = [[], [raced]];
    state.insertAccountError = { code: "23505" };
    state.insertMembershipError = { code: "23505" };

    await expect(enroll("program-1", INPUT)).rejects.toMatchObject({
      status: 409,
      code: "already_member",
    });

    expect(state.statements.filter((s) => s.kind === "update")).toHaveLength(0);
    expect(state.rows["acc-existing"].firstName).toBe("Cliente iOS 4");
  });
});
