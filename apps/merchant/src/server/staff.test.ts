import { describe, expect, it, vi } from "vitest";

// Controlled data for the fake db.
let existingUsers: Array<{ id: string }> = [];

vi.mock("./db", () => {
  const chain: Record<string, unknown> = {};
  for (const m of [
    "select",
    "from",
    "where",
    "insert",
    "values",
    "update",
    "set",
    "delete",
  ]) {
    chain[m] = () => chain;
  }
  chain.limit = () => Promise.resolve(existingUsers);
  chain.returning = () => Promise.resolve([]);
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve([]);
  return { getDb: () => chain };
});

import { setStaffStatus } from "./staff";

/**
 * El alta (`createStaff`) se mudó a `staff-create.ts` con la spec 0067 y tiene su propio
 * archivo de tests (`staff-create.test.ts`): este quedó con la baja/alta de estado, que no
 * cambió. Ninguna cobertura se perdió en la mudanza.
 */
const business = { id: "b1", slug: "negocio" };

describe("setStaffStatus validation — spec 0043", () => {
  it("rejects an invalid status with 400", async () => {
    await expect(
      setStaffStatus(business, "owner", "u1", "banned"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a missing target with 400", async () => {
    await expect(
      setStaffStatus(business, "owner", "", "active"),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 404 when the target is not a member of the business", async () => {
    existingUsers = []; // target lookup resolves to no row
    await expect(
      setStaffStatus(business, "owner", "ghost", "disabled"),
    ).rejects.toMatchObject({ status: 404 });
  });
});
