import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/neon-http";
vi.mock("@mi-pasaporte/db", () => ({ getDb: () => drizzle.mock() }));
import { backofficeMembershipQuery } from "./backoffice-membership";
import { billingFromSubscription } from "./billing-gate";

describe("backoffice membership JOIN projection and SQL", () => {
  it.each([
    ["page", ["user"]],
    ["active-member", ["user", "active"]],
    ["active-owner", ["user", "owner", "active"]],
  ] as const)(
    "preserves %s mode selection, order and single nullable subscription",
    (mode, parameters) => {
      const query = backofficeMembershipQuery("user", mode).toSQL();
      expect(query.params).toEqual([...parameters, 1]);
      expect(query.sql).toContain('left join "core"."subscription"');
      expect(query.sql).toContain(
        'order by "core"."business"."created_at" asc',
      );
      expect(query.sql).toContain('"category_gcid"');
      expect(query.sql).toContain('"trial_ends_at"');
      expect(query.sql).not.toMatch(/order by[^]*business_membership/);
    },
  );
  it("distinguishes an absent subscription from a current trial using the existing decision", () => {
    const now = new Date("2026-10-18T12:00:00Z");
    expect(billingFromSubscription(null, now)).toMatchObject({
      access: "blocked",
      failure: { status: 402, code: "payment_required" },
    });
    expect(
      billingFromSubscription(
        {
          plan: "trial",
          status: "active",
          stripeSubscriptionId: null,
          stripeCustomerId: null,
          trialEndsAt: new Date(+now + 1000),
        },
        now,
      ),
    ).toEqual({
      access: "trial",
      trialEndsAt: new Date(+now + 1000),
      failure: null,
    });
  });
});
