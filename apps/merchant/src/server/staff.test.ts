import { beforeEach, describe, expect, it, vi } from "vitest";

// Controlled data for the fake db.
let existingUsers: Array<{ id: string }> = [];
const dbCalls = vi.hoisted(() => ({
  transaction: vi.fn(),
  lock: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@mi-pasaporte/db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "from", "innerJoin", "where", "values", "set"]) {
    chain[m] = () => chain;
  }
  for (const method of ["insert", "update", "delete"] as const) {
    chain[method] = dbCalls[method].mockImplementation(() => chain);
  }
  // SPEC0231 first locks the existing business, then looks up the linked membership.
  chain.for = dbCalls.lock.mockResolvedValue([{ id: "b1" }]);
  chain.limit = () => Promise.resolve(existingUsers);
  chain.returning = () => Promise.resolve([]);
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve(existingUsers);
  return {
    getDb: () => chain,
    withDbTransaction: dbCalls.transaction.mockImplementation(
      (work: (tx: typeof chain) => unknown) => work(chain),
    ),
  };
});

import { setStaffStatus } from "./staff";

/**
 * El alta (`createStaff`) se mudó a `staff-create.ts` con la spec 0067 y tiene su propio
 * archivo de tests (`staff-create.test.ts`): este conserva las validaciones de baja/alta.
 * SPEC0231 añadió la transacción y mantenimiento de identidad, ejercitados sin mockear el writer.
 */
const business = { id: "b1", slug: "negocio" };

beforeEach(() => {
  vi.clearAllMocks();
  existingUsers = [];
});

describe("setStaffStatus validation — spec 0043", () => {
  it("rejects an invalid status with 400", async () => {
    await expect(
      setStaffStatus(business, "owner", "u1", "banned"),
    ).rejects.toMatchObject({ status: 400 });
    expect(dbCalls.transaction).not.toHaveBeenCalled();
  });

  it("rejects a missing target with 400", async () => {
    await expect(
      setStaffStatus(business, "owner", "", "active"),
    ).rejects.toMatchObject({
      status: 400,
    });
    expect(dbCalls.transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the target is not a member of the business", async () => {
    await expect(
      setStaffStatus(business, "owner", "ghost", "disabled"),
    ).rejects.toMatchObject({ status: 404, code: "staff_not_found" });
    expect(dbCalls.transaction).toHaveBeenCalledTimes(1);
    expect(dbCalls.lock).toHaveBeenCalledExactlyOnceWith("key share");
    expect(dbCalls.insert).not.toHaveBeenCalled();
    expect(dbCalls.update).not.toHaveBeenCalled();
    expect(dbCalls.delete).not.toHaveBeenCalled();
  });
});
