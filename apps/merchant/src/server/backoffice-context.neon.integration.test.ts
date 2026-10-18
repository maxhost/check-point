import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { permisosIntegrationEnabled } from "./permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  memberships,
  sessions,
  subscriptions,
  users,
} from "@mi-pasaporte/db/schema";
import { openMerchantSession } from "./merchant-session";
const injection = vi.hoisted(() => ({
  enabled: false,
  joins: 0,
  recoveries: 0,
  subscriptionReads: 0,
}));
/** Test-local query injection: PostgreSQL 22012 in JOIN only, no DDL or auth response mock. */
vi.mock("@mi-pasaporte/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mi-pasaporte/db")>();
  const { sql } = await import("drizzle-orm");
  return {
    ...actual,
    getDb: () => {
      const db = actual.getDb(),
        select = db.select.bind(db);
      db.select = ((projection?: Record<string, unknown>) => {
        if (projection?.subscription) {
          injection.joins++;
          if (injection.enabled)
            return select({ ...projection, injectedFailure: sql`1/0` });
        } else if (projection?.categoryGcid) injection.recoveries++;
        else if (projection?.stripeSubscriptionId && projection?.trialEndsAt)
          injection.subscriptionReads++;
        return select(projection as Parameters<typeof select>[0]);
      }) as typeof db.select;
      return db;
    },
  };
});
import { getBackofficeRequestContext } from "./backoffice-context";
import { backofficeMembershipQuery } from "./backoffice-membership";
import { requireApiOwner } from "./api-owner";
import { requireApiPermission } from "./api-permission";
const ids = Array.from({ length: 4 }, () => randomUUID()),
  owners = Array.from({ length: 3 }, () => randomUUID());
let cookieA: string, cookieB: string;
const request = (cookie: string) =>
  new Request("http://localhost:3001/api/analytics/inbox", {
    headers: { cookie },
  });
const cookieFor = async (id: string) =>
  (await openMerchantSession(id)).split(";")[0];
const originalErrorCode = (error: unknown) =>
  (error as { cause?: { code?: string } }).cause?.code;

describe.skipIf(!permisosIntegrationEnabled)(
  "A2b native auth, JOIN selection and protected query plans",
  () => {
    beforeAll(async () => {
      const db = getDb(),
        now = new Date();
      await db.insert(users).values(
        owners.map((id) => ({
          id,
          name: "Synthetic A2b",
          email: `a2b-${id}@example.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        })),
      );
      await db.insert(businesses).values(
        ids.map((id, index) => ({
          id,
          name: `Synthetic A2b ${index}`,
          slug: `a2b-${id}`,
          countryCode: "EC",
          currencyCode: "USD",
          timezone: "America/Guayaquil",
          createdAt: new Date(`200${index}-01-01T12:00:00Z`),
        })),
      );
      await db.insert(memberships).values([
        {
          businessId: ids[0],
          userId: owners[0],
          role: "owner",
          status: "disabled",
          pinMustChange: false,
        },
        {
          businessId: ids[1],
          userId: owners[0],
          role: "staff",
          status: "active",
          permissions: ["analytics"],
          handle: "synthetic",
          pinHash: "synthetic-hash",
          pinMustChange: false,
        },
        {
          businessId: ids[2],
          userId: owners[0],
          role: "owner",
          status: "active",
          pinMustChange: false,
        },
        {
          businessId: ids[3],
          userId: owners[1],
          role: "owner",
          status: "active",
          pinMustChange: false,
        },
        {
          businessId: ids[3],
          userId: owners[2],
          role: "owner",
          status: "active",
          pinMustChange: false,
        },
      ]);
      await db.insert(subscriptions).values(
        [ids[0], ids[2], ids[3]].map((businessId) => ({
          businessId,
          plan: "trial",
          status: "active",
          trialEndsAt: new Date(+now + 86_400_000),
        })),
      );
      cookieA = await cookieFor(owners[0]);
      cookieB = await cookieFor(owners[1]);
    }, 60_000);
    afterAll(async () => {
      injection.enabled = false;
      await getDb().delete(businesses).where(inArray(businesses.id, ids));
      await getDb().delete(users).where(inArray(users.id, owners));
    }, 60_000);
    it("preserves divergent page/member/owner modes with real multiple memberships and 0..1 subscription", async () => {
      const context = getBackofficeRequestContext(request(cookieA));
      expect((await context.readMembership("page"))?.id).toBe(ids[0]);
      expect((await context.readMembership("page"))?.status).toBe("disabled");
      expect((await context.readMembership("active-member"))?.id).toBe(ids[1]);
      expect((await context.readMembership("active-owner"))?.id).toBe(ids[2]);
      const absent = await context.readSelection("active-member");
      if (absent.state !== "joined") throw new Error("Expected native JOIN");
      expect(absent.data?.subscription).toBeNull();
      expect(await context.readBilling(ids[1], "active-member")).toMatchObject({
        access: "blocked",
        failure: { code: "payment_required" },
      });
      expect((await context.readBilling(ids[2], "active-owner")).access).toBe(
        "trial",
      );
      expect(
        await requireApiPermission(request(cookieA), "analytics"),
      ).toMatchObject({ failure: { code: "payment_required" } });
      const other = await requireApiOwner(request(cookieB));
      if ("failure" in other)
        throw new Error("Expected second authenticated owner");
      expect(other.business.id).toBe(ids[3]);
      expect(Object.keys(other.business).sort()).toEqual(
        [
          "id",
          "slug",
          "countryCode",
          "currencyCode",
          "status",
          "suspensionReason",
        ].sort(),
      );
    }, 30_000);
    it("executes one JOIN and no separate billing read, with exact SQL and non-ANALYZE EXPLAIN", async () => {
      const context = getBackofficeRequestContext(request(cookieA)),
        before = injection.joins,
        billingBefore = injection.subscriptionReads;
      await context.readMembership("active-owner");
      await context.readBilling(ids[2], "active-owner");
      await context.readMembership("active-owner");
      await context.readBilling(ids[2], "active-owner");
      expect(injection.joins - before).toBe(1);
      expect(injection.subscriptionReads - billingBefore).toBe(0);
      const query = backofficeMembershipQuery(owners[0], "active-owner");
      const plan = await getDb().execute(
        sql`EXPLAIN (FORMAT JSON) ${query.getSQL()}`,
      );
      expect(JSON.stringify(plan.rows)).toContain("subscription");
      console.info(
        "A2B_JOIN_PLAN",
        JSON.stringify({
          businesses: ids.length,
          memberships: 5,
          subscriptions: 3,
          query: query.toSQL(),
          plan: plan.rows,
        }),
      );
    }, 30_000);
    it("preserves pre-denials and original PostgreSQL failure with one real member-only recovery", async () => {
      injection.enabled = true;
      try {
        expect(
          await requireApiPermission(request(cookieA), "brand"),
        ).toMatchObject({ failure: { code: "missing_permission" } });
        await getDb()
          .update(users)
          .set({ emailVerified: false })
          .where(eq(users.id, owners[0]));
        expect(await requireApiOwner(request(cookieA))).toMatchObject({
          failure: { code: "email_not_verified" },
        });
        await getDb()
          .update(users)
          .set({ emailVerified: true })
          .where(eq(users.id, owners[0]));
        const context = getBackofficeRequestContext(request(cookieA)),
          joins = injection.joins,
          recoveries = injection.recoveries;
        expect((await context.readMembership("active-owner"))?.id).toBe(ids[2]);
        let original: unknown;
        try {
          await context.readBilling(ids[2], "active-owner");
        } catch (error) {
          original = error;
        }
        expect(originalErrorCode(original)).toBe("22012");
        await expect(context.readBilling(ids[2], "active-owner")).rejects.toBe(
          original,
        );
        expect(injection.joins - joins).toBe(1);
        expect(injection.recoveries - recoveries).toBe(1);
        const page = getBackofficeRequestContext(request(cookieA));
        expect(await page.readMembership("page")).toMatchObject({
          id: ids[0],
          status: "disabled",
        });
      } finally {
        injection.enabled = false;
        await getDb()
          .update(users)
          .set({ emailVerified: true })
          .where(eq(users.id, owners[0]));
      }
    }, 30_000);
    it("rejects forged and expired native cookies before a JOIN", async () => {
      const forged = `${cookieA.slice(0, cookieA.indexOf("="))}=forged.invalid`,
        before = injection.joins,
        billingBefore = injection.subscriptionReads;
      expect(
        await getBackofficeRequestContext(request(forged)).readSession(),
      ).toBeNull();
      const expired = await cookieFor(owners[2]);
      await getDb()
        .update(sessions)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(eq(sessions.userId, owners[2]));
      expect(
        await getBackofficeRequestContext(request(expired)).readMembership(
          "active-member",
        ),
      ).toBeNull();
      expect(injection.joins).toBe(before);
      expect(injection.subscriptionReads - billingBefore).toBe(0);
    }, 30_000);
    it("honors native session revocation between Requests from the same user", async () => {
      const old = getBackofficeRequestContext(request(cookieA));
      expect(await old.readSession()).not.toBeNull();
      await getDb().delete(sessions).where(eq(sessions.userId, owners[0]));
      const next = getBackofficeRequestContext(request(cookieA));
      expect(await next.readSession()).toBeNull();
      expect(await next.readMembership("active-member")).toBeNull();
    }, 30_000);
  },
);
