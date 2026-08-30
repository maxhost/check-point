import { afterEach, describe, expect, it, vi } from "vitest";

// Controlled data for the fake db + auth.
let existingUsers: Array<{ id: string }> = [];
let insertRows: Array<{ role: string; status: string; createdAt: Date }> = [];
let signUpImpl: () => Promise<{ user: { id: string } }> = async () => ({
  user: { id: "staff-user-1" },
});

vi.mock("./auth", () => ({
  getMerchantAuth: () => ({
    api: { signUpEmail: () => signUpImpl() },
  }),
}));

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
  chain.returning = () => Promise.resolve(insertRows);
  chain.then = (resolve: (v: unknown[]) => unknown) => resolve([]);
  return { getDb: () => chain };
});

import { StaffError, createStaff, setStaffStatus } from "./staff";

const business = { id: "b1" };

afterEach(() => {
  existingUsers = [];
  insertRows = [];
  signUpImpl = async () => ({ user: { id: "staff-user-1" } });
});

describe("createStaff validation (alta) — spec 0043", () => {
  const cases: Array<[string, unknown]> = [
    ["missing body", null],
    ["empty name", { name: "  ", email: "a@b.co", password: "12345678" }],
    ["bad email", { name: "Ana", email: "nope", password: "12345678" }],
    ["short password", { name: "Ana", email: "a@b.co", password: "1234567" }],
  ];
  for (const [label, body] of cases) {
    it(`rejects ${label} with 400`, async () => {
      await expect(createStaff(business, body)).rejects.toMatchObject({
        status: 400,
      });
    });
  }
});

describe("createStaff DTO carries no secrets — spec 0043", () => {
  it("returns only safe fields and never a password/hash/token", async () => {
    existingUsers = [];
    insertRows = [{ role: "staff", status: "active", createdAt: new Date(0) }];
    const dto = await createStaff(business, {
      name: "Ana",
      email: "Ana@Bar.co",
      password: "supersecret",
    });
    expect(Object.keys(dto).sort()).toEqual([
      "createdAt",
      "email",
      "name",
      "role",
      "status",
      "userId",
    ]);
    expect(dto.email).toBe("ana@bar.co"); // normalized
    expect(dto.role).toBe("staff");
    const serialized = JSON.stringify(dto).toLowerCase();
    expect(serialized).not.toContain("supersecret");
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("hash");
    expect(serialized).not.toContain("token");
  });

  it("rejects a duplicate email with 409 (pre-check)", async () => {
    existingUsers = [{ id: "existing" }];
    await expect(
      createStaff(business, {
        name: "Ana",
        email: "dupe@bar.co",
        password: "supersecret",
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("maps a better-auth failure to a StaffError", async () => {
    existingUsers = [];
    signUpImpl = async () => {
      throw new Error("boom");
    };
    await expect(
      createStaff(business, {
        name: "Ana",
        email: "new@bar.co",
        password: "supersecret",
      }),
    ).rejects.toBeInstanceOf(StaffError);
  });
});

describe("setStaffStatus validation — spec 0043", () => {
  it("rejects an invalid status with 400", async () => {
    await expect(
      setStaffStatus(business, "u1", "banned"),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects a missing target with 400", async () => {
    await expect(setStaffStatus(business, "", "active")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("returns 404 when the target is not a member of the business", async () => {
    existingUsers = []; // target lookup resolves to no row
    await expect(
      setStaffStatus(business, "ghost", "disabled"),
    ).rejects.toMatchObject({ status: 404 });
  });
});
