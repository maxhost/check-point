import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { getDb } from "./db";
import { loyaltyPrograms, programMemberships } from "./schema";
import { resolveScan } from "./counter/resolve";
import { grantAccrual } from "./counter/grant";

describe.skipIf(!integrationEnabled)(
  "counter guards against Neon (spec 0030)",
  () => {
    it("refuses to accredit a membership of another business (403)", async () => {
      const home = await seedBusiness({
        name: "Mi Negocio",
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "3.00",
      });
      const other = await seedBusiness({
        name: "Otro Negocio",
        kind: "points",
        mode: "per_amount",
        grant: 5,
        blockAmount: "1.00",
      });
      try {
        const consumer = await seedConsumer();
        const resolved = await resolveScan(other.business, consumer.qrToken);
        await expect(
          grantAccrual(home.business, home.userId, {
            clientRequestId: randomUUID(),
            membershipId: resolved.membership.id, // belongs to `other`
            mode: "quick",
            total: "5.00",
          }),
        ).rejects.toMatchObject({ status: 403, code: "foreign_membership" });
      } finally {
        await dropBusiness(home.business.id);
        await dropBusiness(other.business.id);
      }
    }, 30_000);

    it("stamps per_purchase grants the flat amount regardless of total", async () => {
      const stamps = await seedBusiness({
        name: "Bar Sellos",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
      try {
        const consumer = await seedConsumer();
        const resolved = await resolveScan(stamps.business, consumer.qrToken);
        expect(resolved.membership.stampsCount).toBe(0);
        const result = await grantAccrual(stamps.business, stamps.userId, {
          clientRequestId: randomUUID(),
          membershipId: resolved.membership.id,
          mode: "quick",
          total: "999.00",
        });
        expect(result.order.kind).toBe("stamps");
        expect(result.order.unitsGranted).toBe(1);
        expect(result.order.balanceAfter).toBe(1);
        const [m] = await getDb()
          .select({ stampsCount: programMemberships.stampsCount })
          .from(programMemberships)
          .where(eq(programMemberships.id, resolved.membership.id));
        expect(m.stampsCount).toBe(1);
      } finally {
        await dropBusiness(stamps.business.id);
      }
    }, 30_000);

    it("returns 404 when the business has no accreditable program", async () => {
      const bare = await seedBusiness({
        name: "Sin Programa",
        kind: "points",
        mode: "per_amount",
        grant: 1,
        blockAmount: "1.00",
      });
      await getDb()
        .delete(loyaltyPrograms)
        .where(eq(loyaltyPrograms.id, bare.programId));
      try {
        const consumer = await seedConsumer();
        await expect(
          resolveScan(bare.business, consumer.qrToken),
        ).rejects.toMatchObject({ status: 404, code: "no_program" });
      } finally {
        await dropBusiness(bare.business.id);
      }
    }, 30_000);
  },
);
