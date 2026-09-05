import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Unit coverage for the re-enroll leaving the profile alone (ADR 0051 / spec 0054,
 * reverting the ADR 0050 / spec 0053 name refresh — the inversion of these tests is
 * authorized by the ADR 0051 itself).
 *
 * The DB effect is proven against a real Neon branch
 * (`consumer-enrollment-name.neon.integration.test.ts`); what is checked HERE is the
 * shape of what `enroll()` hands back — the 201, the Wallet pass and the portal all
 * read off `result.account`, so it must be the STORED row (typed name discarded) plus
 * the `existingAccount` flag the confirmation toast depends on.
 *
 * The fake db is a recording chain: it answers `select … limit` from a per-table queue
 * and records every statement, so the tests can assert that `enroll()` issues NO write
 * on `consumer_account` other than the insert of a brand-new alta — no UPDATE exists
 * on any path, successful or not.
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

/** Every recorded write (insert/update/delete) touching consumer_account. */
function accountWrites(): Statement[] {
  return state.statements.filter(
    (s) => s.kind !== "select" && s.table === "consumer_account",
  );
}

afterEach(() => {
  state.reads = {};
  state.rows = {};
  state.insertAccountError = null;
  state.insertMembershipError = null;
  state.statements = [];
});

describe("enroll() reuses the stored profile as-is — spec 0054 / ADR 0051", () => {
  it("hands back the stored row untouched: the typed name is discarded", async () => {
    const existing = storedAccount();
    queueProgram();
    state.reads.consumer_account = [[existing]];

    const { account, existingAccount } = await enroll("program-1", INPUT);

    // Same identity, same data — including the name the user did NOT get to change.
    expect(account.id).toBe("acc-existing");
    expect(account.firstName).toBe("Cliente iOS 4");
    expect(account.lastName).toBe("QA");
    expect(existingAccount).toBe(true);
  });

  it("issues NO write on consumer_account when the phone already has one", async () => {
    const existing = storedAccount();
    queueProgram();
    state.reads.consumer_account = [[existing]];

    const { account } = await enroll("program-1", INPUT);

    expect(accountWrites()).toHaveLength(0);
    // Identity and credentials survive untouched in the returned row.
    expect(account.phoneE164).toBe(PHONE);
    expect(account.countryIso).toBe("EC");
    expect(account.qrToken).toBe("qr-token-original");
    expect(account.webViewToken).toBe("web-view-token-original");
    expect(account.phoneVerifiedAt).toBeNull();
    // And the stored row itself never moved.
    expect(state.rows["acc-existing"].firstName).toBe("Cliente iOS 4");
    expect(state.rows["acc-existing"].updatedAt).toEqual(
      new Date("2026-08-16T00:00:00Z"),
    );
  });

  it("the concurrent-race path (23505 on insert) also reuses the row as-is, flagged existing", async () => {
    const raced = storedAccount();
    queueProgram();
    // First read finds nothing → insert → 23505 (a concurrent enroll won) → re-read.
    state.reads.consumer_account = [[], [raced]];
    state.insertAccountError = { code: "23505" };

    const { account, existingAccount } = await enroll("program-1", INPUT);

    expect(account.id).toBe("acc-existing");
    // The row created by the race wins whole: name, tokens, everything.
    expect(account.firstName).toBe("Cliente iOS 4");
    expect(account.lastName).toBe("QA");
    expect(account.qrToken).toBe("qr-token-original");
    // It pre-existed this request (by an instant) → the toast applies here too.
    expect(existingAccount).toBe(true);
    expect(state.statements.filter((s) => s.kind === "update")).toHaveLength(0);
  });

  it("a brand-new phone inserts the account (the ONLY account write) and is not flagged existing", async () => {
    queueProgram();
    state.reads.consumer_account = [[]];

    const { account, membership, existingAccount } = await enroll(
      "program-1",
      INPUT,
    );

    const writes = accountWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0].kind).toBe("insert");
    expect(account.firstName).toBe("Logan");
    expect(account.countryIso).toBe("AR");
    expect(account.qrToken).toBeTruthy();
    expect(membership.programId).toBe("program-1");
    expect(existingAccount).toBe(false);
  });

  it("a successful re-enroll writes ONLY the membership — no statement ever targets the account", async () => {
    const existing = storedAccount();
    queueProgram();
    state.reads.consumer_account = [[existing]];

    await enroll("program-1", INPUT);

    const writes = state.statements.filter((s) => s.kind !== "select");
    expect(writes.map((s) => `${s.kind} ${s.table}`)).toEqual([
      "insert program_membership",
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

    expect(accountWrites()).toHaveLength(0);
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
