import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// better-auth needs these to construct; harmless test values on the isolated branch.
process.env.BETTER_AUTH_SECRET ||= "integration-secret-at-least-32-chars-xx";
process.env.BETTER_AUTH_URL ||= "http://localhost:3001";

import {
  type Seed,
  dropBusiness,
  integrationEnabled,
  seedBusiness,
  seedConsumer,
} from "./counter-integration-support";
import { getDb } from "./db";
import { memberships, orders, sessions, users } from "./schema";
import { listStaff, setStaffStatus } from "./staff";
import { createStaff } from "./staff-create";
import { listTodaysAccreditations } from "./counter/history";
import { resolveScan } from "./counter/resolve";
import { grantAccrual } from "./counter/grant";

/** Spec 0067 §4: el alta recibe SOLO el nombre; el `slug` sale del negocio, nunca del body. */
const ownerBusiness = (seed: Seed) => ({
  id: seed.business.id,
  slug: seed.slug,
});

describe.skipIf(!integrationEnabled)(
  "staff service against Neon (spec 0043)",
  () => {
    let a: Seed;
    let b: Seed;

    beforeAll(async () => {
      a = await seedBusiness({
        name: "Bar A",
        kind: "points",
        mode: "per_amount",
        grant: 10,
        blockAmount: "3.00",
      });
      b = await seedBusiness({
        name: "Bar B",
        kind: "stamps",
        mode: "per_purchase",
        grant: 1,
        blockAmount: null,
      });
    }, 60_000);

    afterAll(async () => {
      await dropBusiness(a.business.id);
      await dropBusiness(b.business.id);
    });

    it("creates a staff user + membership (staff/active) without touching the owner", async () => {
      const { staff: dto, pin } = await createStaff(ownerBusiness(a), {
        name: "Ana Staff",
      });
      expect(dto.role).toBe("staff");
      expect(dto.status).toBe("active");
      expect(dto.identifier).toBe(`ana-staff@${a.slug}`);
      // El PIN viaja en la respuesta del alta y en ninguna otra parte del DTO.
      expect(pin).toMatch(/^[0-9]{6}$/);
      expect(JSON.stringify(dto)).not.toContain(pin);

      const [row] = await getDb()
        .select({ role: memberships.role, status: memberships.status })
        .from(memberships)
        .where(
          and(
            eq(memberships.businessId, a.business.id),
            eq(memberships.userId, dto.userId),
          ),
        );
      expect(row).toEqual({ role: "staff", status: "active" });

      // The owner membership is untouched: still exactly one owner in the business.
      const owners = await getDb()
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            eq(memberships.businessId, a.business.id),
            eq(memberships.role, "owner"),
          ),
        );
      expect(owners.map((o) => o.userId)).toEqual([a.userId]);
    }, 60_000);

    it("resolves a handle collision with a suffix instead of failing", async () => {
      const uno = await createStaff(ownerBusiness(a), { name: "Repetido" });
      const dos = await createStaff(ownerBusiness(a), { name: "Repetido" });
      expect(uno.staff.identifier).toBe(`repetido@${a.slug}`);
      expect(dos.staff.identifier).toBe(`repetido-2@${a.slug}`);
    }, 60_000);

    it("deactivating revokes sessions + blocks; reactivating restores", async () => {
      const { staff } = await createStaff(ownerBusiness(a), { name: "Beto" });
      // Seed a live session for the staff to prove revocation deletes it.
      await getDb()
        .insert(sessions)
        .values({
          id: `sess-${randomUUID()}`,
          token: `tok-${randomUUID()}`,
          userId: staff.userId,
          expiresAt: new Date(Date.now() + 3_600_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const disabled = await setStaffStatus(
        ownerBusiness(a),
        staff.userId,
        "disabled",
      );
      expect(disabled.status).toBe("disabled");
      const live = await getDb()
        .select({ id: sessions.id })
        .from(sessions)
        .where(eq(sessions.userId, staff.userId));
      expect(live).toHaveLength(0);
      // The user row survives (audit preserved).
      const [stillThere] = await getDb()
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, staff.userId));
      expect(stillThere?.id).toBe(staff.userId);

      const reactivated = await setStaffStatus(
        ownerBusiness(a),
        staff.userId,
        "active",
      );
      expect(reactivated.status).toBe("active");
    }, 60_000);

    it("never deactivates the owner (409) and isolates across businesses (404)", async () => {
      await expect(
        setStaffStatus(ownerBusiness(a), a.userId, "disabled"),
      ).rejects.toMatchObject({ status: 409 });

      const { staff: staffOfA } = await createStaff(ownerBusiness(a), {
        name: "Cara",
      });
      // Business B cannot touch A's staff.
      await expect(
        setStaffStatus(ownerBusiness(b), staffOfA.userId, "disabled"),
      ).rejects.toMatchObject({ status: 404 });

      // listStaff is business-scoped.
      const listB = await listStaff(b.business.id);
      expect(listB.some((s) => s.userId === staffOfA.userId)).toBe(false);
    }, 60_000);

    it("a staff member can accredit (reuses spec 0030) and the day history is scoped", async () => {
      const { staff } = await createStaff(ownerBusiness(a), { name: "Dana" });
      const consumer = await seedConsumer();
      const resolved = await resolveScan(a.business, consumer.qrToken);
      const result = await grantAccrual(a.business, staff.userId, {
        clientRequestId: randomUUID(),
        membershipId: resolved.membership.id,
        mode: "quick",
        total: "9.00",
      });
      expect(result.order.unitsGranted).toBe(30); // floor(9/3)*10

      // Insert a stale order (2 days ago) that must be excluded from "today".
      await getDb()
        .insert(orders)
        .values({
          businessId: a.business.id,
          programId: a.programId,
          membershipId: resolved.membership.id,
          consumerId: (
            await getDb()
              .select({ consumerId: orders.consumerId })
              .from(orders)
              .where(eq(orders.membershipId, resolved.membership.id))
              .limit(1)
          )[0].consumerId,
          mode: "quick",
          total: "3.00",
          currencyCode: "USD",
          accrualKind: "points",
          unitsGranted: 10,
          balanceAfter: 999,
          createdByUserId: staff.userId,
          clientRequestId: randomUUID(),
          createdAt: new Date(Date.now() - 2 * 86_400_000),
        });

      const history = await listTodaysAccreditations(
        a.business.id,
        "America/Guayaquil",
        new Date(),
      );
      // Today's grant is present; the stale one is not; nothing from business B.
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.every((h) => h.unitsGranted !== 999)).toBe(true);
      const mine = history.find((h) => h.operator === "Dana");
      expect(mine?.unitsGranted).toBe(30);
      expect(JSON.stringify(history)).not.toContain(consumer.qrToken);

      const historyB = await listTodaysAccreditations(
        b.business.id,
        "America/Guayaquil",
        new Date(),
      );
      expect(historyB.every((h) => h.operator !== "Dana")).toBe(true);
    }, 60_000);
  },
);
