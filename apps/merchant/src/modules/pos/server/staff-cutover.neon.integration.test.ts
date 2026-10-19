import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { withDbTransaction } from "@mi-pasaporte/db";
import {
  businesses,
  businessModules,
  memberships,
  users,
} from "@mi-pasaporte/db/schema";

const enabled =
  !!process.env.NEON_INTEGRATION_DATABASE_URL &&
  process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled)
  process.env.DATABASE_URL = process.env.NEON_INTEGRATION_DATABASE_URL;
const migration = readFileSync(
  join(
    import.meta.dirname,
    "../../../../../../packages/db/drizzle/0107_pos_staff_cutover.sql",
  ),
  "utf8",
);

describe.skipIf(!enabled)(
  "staff permission cutover 0107 (isolated Neon)",
  () => {
    it("adds only the same-business active module permission, preserves other rows and is idempotent", async () => {
      const rollback = new Error("owned fixture rollback");
      await expect(
        withDbTransaction(async (tx) => {
          const businessIds = [randomUUID(), randomUUID(), randomUUID()];
          await tx.insert(businesses).values(
            businessIds.map((id) => ({
              id,
              name: `Cutover ${id}`,
              countryCode: "EC",
              timezone: "America/Guayaquil",
            })),
          );
          await tx.insert(businessModules).values([
            { businessId: businessIds[0], moduleId: "pos", enabled: true },
            { businessId: businessIds[1], moduleId: "pos", enabled: false },
          ]);
          const fixtures = [
            {
              business: 0,
              role: "staff",
              status: "active",
              permissions: ["counter", "catalog"],
            },
            {
              business: 0,
              role: "staff",
              status: "active",
              permissions: ["counter", "pos", "marketing"],
            },
            {
              business: 0,
              role: "staff",
              status: "disabled",
              permissions: ["counter"],
            },
            {
              business: 0,
              role: "staff",
              status: "active",
              permissions: ["catalog"],
            },
            { business: 0, role: "owner", status: "active", permissions: [] },
            {
              business: 1,
              role: "staff",
              status: "active",
              permissions: ["counter"],
            },
            {
              business: 2,
              role: "staff",
              status: "active",
              permissions: ["counter"],
            },
          ].map((fixture) => ({ ...fixture, userId: randomUUID() }));
          const now = new Date();
          await tx.insert(users).values(
            fixtures.map(({ userId }) => ({
              id: userId,
              name: "Cutover fixture",
              email: `${userId}@cutover.invalid`,
              createdAt: now,
              updatedAt: now,
            })),
          );
          await tx.insert(memberships).values(
            fixtures.map(({ business, ...fixture }, index) => ({
              ...fixture,
              businessId: businessIds[business],
              handle: `staff${index}`,
              pinHash: "fixture-only",
              pinMustChange: false,
            })),
          );
          // A second membership of the same user on an off tenant must not be elevated.
          await tx.insert(memberships).values({
            businessId: businessIds[1],
            userId: fixtures[0].userId,
            role: "staff",
            status: "active",
            permissions: ["counter"],
            handle: "other",
            pinHash: "fixture-only",
          });
          const snapshot = async () =>
            (
              await tx.execute<{
                user_id: string;
                business_id: string;
                permissions: string[];
              }>(sql`
        select user_id, business_id, permissions from core.business_membership
        where business_id in (${businessIds[0]}, ${businessIds[1]}, ${businessIds[2]})
        order by business_id, user_id
      `)
            ).rows;
          const before = await snapshot();
          await tx.execute(sql.raw(migration));
          const after = await snapshot();
          expect(after).toEqual(
            before.map((row) =>
              row.business_id === businessIds[0] &&
              row.user_id === fixtures[0].userId
                ? { ...row, permissions: ["counter", "catalog", "pos"] }
                : row,
            ),
          );
          await tx.execute(sql.raw(migration));
          expect(await snapshot()).toEqual(after);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
    }, 120_000);
  },
);
