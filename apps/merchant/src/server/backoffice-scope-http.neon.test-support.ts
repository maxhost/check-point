/** Real CI fixtures only: no auth/domain response mocks. Cleanup is limited to own UUIDs. */
import { randomUUID } from "node:crypto";
import { count, inArray } from "drizzle-orm";
import { getDb } from "@mi-pasaporte/db";
import {
  businesses,
  users,
  memberships,
  subscriptions,
  businessModules,
  businessOnboardingTours,
  analyticsCardStates,
  analyticsCardCandidates,
  analyticsEvaluationRuns,
} from "@mi-pasaporte/db/schema";
import { openMerchantSession } from "./merchant-session";
import { getBackofficeRequestContext } from "./backoffice-context";
import { backofficeScopeKey } from "./backoffice-scope";
import { inboxGET, cardPOST } from "./analytics/http";
import { GET as modulesGET } from "../app/api/modules/route";
import { dispatchModuleRequest } from "../modules/dispatch";
import { GET as checklistGET } from "../app/api/onboarding/checklist/route";
import { POST as tourPOST } from "../app/api/onboarding/tours/[tourId]/route";
import { ONBOARDING_TOURS } from "./onboarding/tours";
import { MODULES } from "../modules/registry";
export const fixture = {
  businessIds: [randomUUID(), randomUUID()],
  userIds: [randomUUID(), randomUUID()],
  trialEnd: new Date(Date.now() + 10 * 86_400_000),
  cookieA: "",
  cookieA2: "",
  cookieB: "",
};
export const cookieFor = async (userId: string) =>
  (await openMerchantSession(userId)).split(";")[0];
export async function setup() {
  const db = getDb();
  await db.insert(users).values(
    fixture.userIds.map((id) => ({
      id,
      name: "Synthetic S",
      email: `scope-${id}@example.test`,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  );
  await db.insert(businesses).values(
    fixture.businessIds.map((id, index) => ({
      id,
      name: `Synthetic S ${index}`,
      slug: `scope-${id}`,
      countryCode: "EC",
      currencyCode: "USD",
      timezone: "America/Guayaquil",
      createdAt: new Date(`200${index}-01-01T12:00:00Z`),
    })),
  );
  await db.insert(memberships).values([
    {
      businessId: fixture.businessIds[0],
      userId: fixture.userIds[0],
      role: "owner",
      status: "active",
      pinMustChange: false,
    },
    {
      businessId: fixture.businessIds[0],
      userId: fixture.userIds[1],
      role: "staff",
      status: "active",
      permissions: ["analytics"],
      handle: "synthetic-s",
      pinHash: "synthetic-hash",
      pinMustChange: false,
    },
    {
      businessId: fixture.businessIds[1],
      userId: fixture.userIds[1],
      role: "owner",
      status: "active",
      pinMustChange: false,
    },
  ]);
  await db.insert(subscriptions).values(
    fixture.businessIds.map((businessId) => ({
      businessId,
      plan: "trial",
      status: "active",
      trialEndsAt: fixture.trialEnd,
    })),
  );
  fixture.cookieA = await cookieFor(fixture.userIds[0]);
  fixture.cookieA2 = await cookieFor(fixture.userIds[0]);
  fixture.cookieB = await cookieFor(fixture.userIds[1]);
}
export async function cleanup() {
  await getDb()
    .delete(businesses)
    .where(inArray(businesses.id, fixture.businessIds));
  await getDb().delete(users).where(inArray(users.id, fixture.userIds));
}
const cardId = randomUUID();
export const surfaces = [
  { name: "Inbox GET", call: inboxGET, method: "GET", body: undefined },
  {
    name: "Inbox decision",
    call: (r: Request) => cardPOST(r, cardId, "resolve"),
    method: "POST",
    body: { expectedVersion: "synthetic-context", operationId: randomUUID() },
  },
  { name: "modules GET", call: modulesGET, method: "GET", body: undefined },
  {
    name: "module toggle",
    call: (r: Request) =>
      dispatchModuleRequest("PUT", r, { moduleId: MODULES[0].id }),
    method: "PUT",
    body: { enabled: true },
  },
  { name: "checklist GET", call: checklistGET, method: "GET", body: undefined },
  {
    name: "tour POST",
    call: (r: Request) =>
      tourPOST(r, { params: Promise.resolve({ tourId: ONBOARDING_TOURS[0] }) }),
    method: "POST",
    body: { status: "completed" },
  },
] as const;
export function request(
  surface: (typeof surfaces)[number],
  cookie: string,
  header?: string,
) {
  return new Request("http://localhost:3001/api/synthetic-scope", {
    method: surface.method,
    headers: {
      cookie,
      "content-type": "application/json",
      ...(header === undefined ? {} : { "X-Backoffice-Scope": header }),
    },
    ...(surface.method !== "GET" ? { body: JSON.stringify(surface.body) } : {}),
  });
}
export async function markFor(cookie: string) {
  const context = getBackofficeRequestContext(request(surfaces[0], cookie)),
    session = await context.readSession(),
    member = await context.readMembership("active-member");
  if (!session || !member)
    throw new Error("Synthetic scope fixture is not ready");
  return backofficeScopeKey(
    {
      sessionId: session.session.id,
      userId: session.user.id,
      businessId: member.id,
    },
    process.env.BETTER_AUTH_SECRET,
  );
}
export async function snapshot() {
  const db = getDb(),
    ids = fixture.businessIds;
  const rows = await Promise.all([
    db
      .select({ total: count() })
      .from(businessModules)
      .where(inArray(businessModules.businessId, ids)),
    db
      .select({ total: count() })
      .from(businessOnboardingTours)
      .where(inArray(businessOnboardingTours.businessId, ids)),
    db
      .select({ total: count() })
      .from(analyticsCardStates)
      .where(inArray(analyticsCardStates.businessId, ids)),
    db
      .select({ total: count() })
      .from(analyticsCardCandidates)
      .where(inArray(analyticsCardCandidates.businessId, ids)),
    db
      .select({ total: count() })
      .from(analyticsEvaluationRuns)
      .where(inArray(analyticsEvaluationRuns.businessId, ids)),
  ]);
  return rows.map(([row]) => row.total);
}
