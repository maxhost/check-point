import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Unit coverage for «the alta never touches the profile» (ADR 0051, kept by ADR 0111 §5).
 *
 * Since spec 0119 the alta receives an EXISTING account (the session's, or the one the provider
 * callback found or created): `enrollAccount()` writes the membership and its projection row and
 * nothing else — no statement ever targets `consumer_account`, on success or on a 409. The «a
 * returning provider identity rewrites nothing» half lives in
 * `apps/consumer/src/server/consumer-identity.neon.integration.test.ts`.
 *
 * The fake db is a recording chain: it answers `select … limit` from a per-table queue and
 * records every statement.
 */

import { type Statement, state } from "./enrollment-name-support";

vi.mock("@mi-pasaporte/db", async () =>
  (await import("./enrollment-name-support")).dbDouble(),
);

import { enrollAccount } from "@mi-pasaporte/domain/server/consumer/enrollment";

function queueProgram() {
  // `businessStatus` entra desde la spec 0072 §D4: la lectura del programa trae el eje
  // `status` del negocio, y el alta nueva se corta si no es `active`.
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

describe("enrollAccount() never writes the account — ADR 0051 / ADR 0111 §5", () => {
  it("a successful alta writes ONLY the membership and its projection row", async () => {
    queueProgram();

    const membership = await enrollAccount("program-1", "acc-existing");

    expect(membership.programId).toBe("program-1");
    const writes = state.statements.filter((s) => s.kind !== "select");
    expect(writes.map((s) => `${s.kind} ${s.table}`)).toEqual([
      "insert program_membership",
      "insert business_customer",
    ]);
    expect(accountWrites()).toHaveLength(0);
  });

  it("a 409 already_member writes NOTHING to the account", async () => {
    queueProgram();
    state.insertMembershipError = { code: "23505" };

    await expect(
      enrollAccount("program-1", "acc-existing"),
    ).rejects.toMatchObject({ status: 409, code: "already_member" });

    expect(accountWrites()).toHaveLength(0);
    expect(state.statements.filter((s) => s.kind === "update")).toHaveLength(0);
  });

  it("an unavailable program is a 404 and writes nothing", async () => {
    state.reads.loyalty_program = [[]];

    await expect(
      enrollAccount("program-1", "acc-existing"),
    ).rejects.toMatchObject({ status: 404, code: "program_unavailable" });

    expect(state.statements.filter((s) => s.kind !== "select")).toEqual([]);
  });
});
