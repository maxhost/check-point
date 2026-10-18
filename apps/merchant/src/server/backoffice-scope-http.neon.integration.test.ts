import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { permisosIntegrationEnabled } from "./permissions-integration-support";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  memberships,
  sessions,
  subscriptions,
  users,
} from "@mi-pasaporte/db/schema";
import * as lifecycle from "./analytics/lifecycle";
import * as evaluation from "./analytics/evaluation";
import * as activation from "../modules/activation";
import * as facts from "./onboarding/checklist-facts";
import * as tours from "./onboarding/tours";
import { getBackofficeRequestContext } from "./backoffice-context";
import { backofficeScopeFailure } from "./backoffice-scope-http";
import { GET as reporterGET } from "../app/api/merchant/session/route";
import { requireApiOwner } from "./api-owner";
import { requireApiPermission } from "./api-permission";
import {
  fixture,
  setup,
  cleanup,
  surfaces,
  request,
  markFor,
  snapshot,
  cookieFor,
} from "./backoffice-scope-http.neon.test-support";
const changed = {
  code: "backoffice_context_changed",
  error: "Tu sesión cambió. Actualiza el panel para continuar.",
};
function observeDomain() {
  return [
    vi.spyOn(lifecycle, "readInbox"),
    vi.spyOn(lifecycle, "decideInboxCard"),
    vi.spyOn(evaluation, "evaluateBusiness"),
    vi.spyOn(activation, "listModulesWithCategory"),
    vi.spyOn(activation, "setModuleEnabled"),
    vi.spyOn(facts, "checklistFacts"),
    vi.spyOn(tours, "recordTourProgress"),
  ];
}
async function privateStatus(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  if (status === 409) expect(await response.json()).toEqual(changed);
}
describe.skipIf(!permisosIntegrationEnabled)(
  "S-server native identity and pre-domain boundary",
  () => {
    beforeAll(setup, 60_000);
    it("reporter remains exempt and never publishes the session mark", async () => {
      const response = await reporterGET(
        request(surfaces[0], fixture.cookieA, "malformed"),
      );
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.authenticated).toBe(true);
      expect(json).not.toHaveProperty("scopeKey");
      expect(json).not.toHaveProperty("session");
    }, 30_000);
    afterAll(cleanup, 60_000);
    it("account switch and new login on same account reject all six surfaces without reads/exposure/writes", async () => {
      const mark = await markFor(fixture.cookieA),
        before = await snapshot(),
        spies = observeDomain();
      try {
        for (const cookie of [fixture.cookieB, fixture.cookieA2]) {
          for (const surface of surfaces)
            await privateStatus(
              await surface.call(request(surface, cookie, mark)),
              409,
            );
        }
        for (const spy of spies) expect(spy).not.toHaveBeenCalled();
        expect(await snapshot()).toEqual(before);
      } finally {
        vi.restoreAllMocks();
      }
    }, 60_000);
    it("uses the guard's actual membership mode for staff A / owner B without reselection", async () => {
      const memberRequest = request(surfaces[0], fixture.cookieB),
        ownerRequest = request(surfaces[3], fixture.cookieB);
      const member = await requireApiPermission(memberRequest, "analytics"),
        owner = await requireApiOwner(ownerRequest);
      expect(member).toMatchObject({
        business: { id: fixture.businessIds[0] },
        role: "staff",
      });
      expect(owner).toMatchObject({ business: { id: fixture.businessIds[1] } });
      const mark = await markFor(fixture.cookieB);
      expect(
        await backofficeScopeFailure(
          request(surfaces[0], fixture.cookieB, mark),
          fixture.businessIds[0],
        ),
      ).toBeNull();
      await privateStatus(
        await surfaces[3].call(request(surfaces[3], fixture.cookieB, mark)),
        409,
      );
    }, 30_000);
    it("matching/legacy modules requests retain real JSON; absent alone bypasses scope, malformed rejects", async () => {
      const mark = await markFor(fixture.cookieA);
      const legacy = await surfaces[2].call(
        request(surfaces[2], fixture.cookieA),
      );
      await privateStatus(legacy, 200);
      const json = await legacy.json();
      expect(json.modules.length).toBeGreaterThan(0);
      const matching = await surfaces[2].call(
        request(surfaces[2], fixture.cookieA, mark),
      );
      await privateStatus(matching, 200);
      expect(await matching.json()).toEqual(json);
      for (const header of ["", "x", "A".repeat(64)])
        await privateStatus(
          await surfaces[2].call(request(surfaces[2], fixture.cookieA, header)),
          409,
        );
      expect(
        await backofficeScopeFailure(
          request(surfaces[2], fixture.cookieA),
          fixture.businessIds[0],
        ),
      ).toBeNull();
    }, 30_000);
    it("forged, expired and revoked native cookies fail auth before scope on all adopted surfaces", async () => {
      const expired = await cookieFor(fixture.userIds[0]),
        revoked = await cookieFor(fixture.userIds[0]);
      const expiredId = (await getBackofficeRequestContext(
        request(surfaces[0], expired),
      ).readSession())!.session.id;
      const revokedId = (await getBackofficeRequestContext(
        request(surfaces[0], revoked),
      ).readSession())!.session.id;
      await getDb()
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, expiredId));
      await getDb().delete(sessions).where(eq(sessions.id, revokedId));
      const spies = observeDomain();
      try {
        for (const cookie of [
          "better-auth.session_token=forged",
          expired,
          revoked,
        ])
          for (const surface of surfaces)
            await privateStatus(
              await surface.call(request(surface, cookie, "malformed")),
              401,
            );
        for (const spy of spies) expect(spy).not.toHaveBeenCalled();
      } finally {
        vi.restoreAllMocks();
      }
    }, 60_000);
    it("real status/email/access/PIN gates precede409, while checklist keeps its email exemption", async () => {
      const db = getDb(),
        businessId = fixture.businessIds[0],
        userId = fixture.userIds[0];
      try {
        await db
          .update(businesses)
          .set({ status: "suspended" })
          .where(eq(businesses.id, businessId));
        await privateStatus(
          await surfaces[0].call(request(surfaces[0], fixture.cookieA, "bad")),
          403,
        );
        await db
          .update(businesses)
          .set({ status: "active" })
          .where(eq(businesses.id, businessId));
        await db
          .update(users)
          .set({ emailVerified: false })
          .where(eq(users.id, userId));
        const email = await surfaces[5].call(
          request(surfaces[5], fixture.cookieA, "bad"),
        );
        await privateStatus(email, 403);
        expect((await email.json()).code).toBe("email_not_verified");
        await privateStatus(
          await surfaces[4].call(request(surfaces[4], fixture.cookieA, "bad")),
          409,
        );
        await db
          .update(users)
          .set({ emailVerified: true })
          .where(eq(users.id, userId));
        await db
          .update(subscriptions)
          .set({ trialEndsAt: new Date(0) })
          .where(eq(subscriptions.businessId, businessId));
        await privateStatus(
          await surfaces[2].call(request(surfaces[2], fixture.cookieA, "bad")),
          402,
        );
        await db
          .update(subscriptions)
          .set({ trialEndsAt: fixture.trialEnd })
          .where(eq(subscriptions.businessId, businessId));
        await db
          .update(memberships)
          .set({ pinMustChange: true })
          .where(eq(memberships.userId, fixture.userIds[1]));
        const pin = await surfaces[2].call(
          request(surfaces[2], fixture.cookieB, "bad"),
        );
        await privateStatus(pin, 403);
        expect((await pin.json()).code).toBe("pin_change_required");
      } finally {
        await db
          .update(businesses)
          .set({ status: "active" })
          .where(eq(businesses.id, businessId));
        await db
          .update(users)
          .set({ emailVerified: true })
          .where(eq(users.id, userId));
        await db
          .update(subscriptions)
          .set({ trialEndsAt: fixture.trialEnd })
          .where(inArray(subscriptions.businessId, fixture.businessIds));
        await db
          .update(memberships)
          .set({ pinMustChange: false })
          .where(inArray(memberships.userId, fixture.userIds));
      }
    }, 60_000);
  },
);
