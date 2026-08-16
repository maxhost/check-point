import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.NEON_INTEGRATION_DATABASE_URL;
const enabled =
  Boolean(url) && process.env.NEON_INTEGRATION_ISOLATED === "true";
if (enabled) process.env.DATABASE_URL = url;

import { getDb } from "../db";
import {
  businesses,
  consumerAccounts,
  loyaltyPrograms,
  orders,
  programMemberships,
  users,
  webPushSubscriptions,
} from "../schema";
import { hasWebPushSubscription } from "../push/subscriptions";
import { listConsumerPrograms } from "./programs";

describe.skipIf(!enabled)(
  "consumer programs against an isolated Neon branch",
  () => {
    const ownerId = `consumer-programs-${randomUUID()}`;
    const businessIds = [randomUUID(), randomUUID()];
    const programIds = [randomUUID(), randomUUID()];
    const consumerIds = [randomUUID(), randomUUID()];
    const membershipIds = [randomUUID(), randomUUID()];
    const now = new Date();

    beforeAll(async () => {
      const db = getDb();
      await db.insert(users).values({
        id: ownerId,
        name: "Programs QA",
        email: `${ownerId}@example.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(businesses).values([
        {
          id: businessIds[0],
          name: "Café Azul",
          countryCode: "EC",
          timezone: "America/Guayaquil",
          brandPrimaryColor: "#001122",
          brandComplementaryColor: "#223344",
          brandAccentColor: "#ff9900",
          logoObjectKey: "qa/logo-a",
          logoVersion: 2,
        },
        {
          id: businessIds[1],
          name: "Peluquería Sol",
          countryCode: "EC",
          timezone: "America/Guayaquil",
          brandPrimaryColor: "#551144",
          brandComplementaryColor: "#773366",
          brandAccentColor: "#ffee00",
        },
      ]);
      await db.insert(loyaltyPrograms).values([
        {
          id: programIds[0],
          businessId: businessIds[0],
          kind: "points",
          configuration: { unitName: "puntos" },
          termsMarkdown: "A",
          termsHash: "a",
          status: "active",
          createdBy: ownerId,
        },
        {
          id: programIds[1],
          businessId: businessIds[1],
          kind: "stamps",
          configuration: { unitName: "sellos", target: 6 },
          termsMarkdown: "B",
          termsHash: "b",
          status: "closing",
          earningEndsAt: new Date("2026-09-01T00:00:00Z"),
          redemptionEndsAt: new Date("2026-10-01T00:00:00Z"),
          createdBy: ownerId,
        },
      ]);
      await db.insert(consumerAccounts).values([
        {
          id: consumerIds[0],
          phoneE164: `+593${Date.now()}1`,
          firstName: "Ana",
          lastName: "QA",
          qrToken: randomUUID(),
          webViewToken: randomUUID(),
        },
        {
          id: consumerIds[1],
          phoneE164: `+593${Date.now()}2`,
          firstName: "Beto",
          lastName: "QA",
          qrToken: randomUUID(),
          webViewToken: randomUUID(),
        },
      ]);
      await db.insert(programMemberships).values([
        {
          id: membershipIds[0],
          consumerId: consumerIds[0],
          programId: programIds[0],
          businessId: businessIds[0],
          pointsBalance: 17,
          enrolledAt: new Date("2026-06-01T00:00:00Z"),
        },
        {
          id: membershipIds[1],
          consumerId: consumerIds[0],
          programId: programIds[1],
          businessId: businessIds[1],
          stampsCount: 2,
          enrolledAt: new Date("2026-07-01T00:00:00Z"),
        },
      ]);
      await db.insert(orders).values({
        businessId: businessIds[0],
        programId: programIds[0],
        membershipId: membershipIds[0],
        consumerId: consumerIds[0],
        mode: "quick",
        total: "1",
        currencyCode: "USD",
        accrualKind: "points",
        unitsGranted: 1,
        balanceAfter: 17,
        createdByUserId: ownerId,
        clientRequestId: randomUUID(),
        createdAt: new Date("2026-08-01T00:00:00Z"),
      });
    }, 30_000);

    afterAll(async () => {
      const db = getDb();
      await db
        .delete(webPushSubscriptions)
        .where(inArray(webPushSubscriptions.consumerId, consumerIds));
      await db
        .delete(orders)
        .where(inArray(orders.membershipId, membershipIds));
      await db
        .delete(programMemberships)
        .where(inArray(programMemberships.id, membershipIds));
      await db
        .delete(consumerAccounts)
        .where(inArray(consumerAccounts.id, consumerIds));
      await db
        .delete(loyaltyPrograms)
        .where(inArray(loyaltyPrograms.id, programIds));
      await db.delete(businesses).where(inArray(businesses.id, businessIds));
      await db.delete(users).where(eq(users.id, ownerId));
    }, 30_000);

    it("returns per-business branding and orders by latest activity", async () => {
      const rows = await listConsumerPrograms(consumerIds[0]);
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.businessName)).toEqual([
        "Café Azul",
        "Peluquería Sol",
      ]);
      expect(rows[0]).toMatchObject({
        pointsBalance: 17,
        brandPrimaryColor: "#001122",
        lastActivityAt: "2026-08-01T00:00:00.000Z",
      });
      expect(rows[1]).toMatchObject({
        stampsCount: 2,
        brandPrimaryColor: "#551144",
        lastActivityAt: "2026-07-01T00:00:00.000Z",
      });
    });

    it("returns [] for another consumer and cannot leak the first consumer's memberships", async () => {
      expect(await listConsumerPrograms(consumerIds[1])).toEqual([]);
    });

    it("detects a Web Push subscription", async () => {
      expect(await hasWebPushSubscription(consumerIds[0])).toBe(false);
      await getDb()
        .insert(webPushSubscriptions)
        .values({
          consumerId: consumerIds[0],
          endpoint: `https://push.example/${randomUUID()}`,
          p256dhKey: "key",
          authKey: "auth",
          platform: "ios",
        });
      expect(await hasWebPushSubscription(consumerIds[0])).toBe(true);
      expect(await hasWebPushSubscription(consumerIds[1])).toBe(false);
    });
  },
);
