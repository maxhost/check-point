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

import { type Row, type Statement, state } from "./enrollment-name-support";

vi.mock("@mi-pasaporte/db", async () =>
  (await import("./enrollment-name-support")).dbDouble(),
);

import { enroll } from "@mi-pasaporte/domain/server/consumer/enrollment";

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
  // `businessStatus` entra desde la spec 0072 §D4: la lectura del programa ahora trae el
  // eje `status` del negocio, y el alta nueva se corta si no es `active`.
  state.reads.loyalty_program = [
    [{ id: "program-1", businessId: "biz-1", businessStatus: "active" }],
  ];
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

  it("a successful re-enroll writes ONLY the membership and its projection row — no statement ever targets the account", async () => {
    const existing = storedAccount();
    queueProgram();
    state.reads.consumer_account = [[existing]];

    await enroll("program-1", INPUT);

    const writes = state.statements.filter((s) => s.kind !== "select");
    expect(writes.map((s) => `${s.kind} ${s.table}`)).toEqual([
      "insert program_membership",
      "insert business_customer",
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
