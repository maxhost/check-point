import { vi } from "vitest";
const h = vi.hoisted(() => ({
  native: vi.fn(),
  join: vi.fn(),
  only: vi.fn(),
  read: vi.fn(),
  decide: vi.fn(),
  evaluate: vi.fn(),
  list: vi.fn(),
  toggle: vi.fn(),
  facts: vi.fn(),
  tour: vi.fn(),
}));
vi.mock("./auth", () => ({
  getMerchantAuth: () => ({ api: { getSession: h.native } }),
}));
vi.mock("./backoffice-membership", () => ({
  readBackofficeMembership: h.join,
  readBackofficeMembershipOnly: h.only,
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("./analytics/lifecycle", () => ({
  readInbox: h.read,
  decideInboxCard: h.decide,
  cleanupInbox: vi.fn(),
}));
vi.mock("./analytics/evaluation", () => ({
  evaluateBusiness: h.evaluate,
  evaluateDueBusinesses: vi.fn(),
}));
vi.mock("./analytics/queries", () => ({
  AnalyticsError: class extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  readDay: vi.fn(),
  readHistory: vi.fn(),
}));
vi.mock("../modules/activation", () => ({
  listModulesWithCategory: h.list,
  setModuleEnabled: h.toggle,
}));
vi.mock("../modules/server-registry", () => ({ SERVER_MODULES: {} }));
vi.mock("./onboarding/checklist-facts", () => ({ checklistFacts: h.facts }));
vi.mock("./onboarding/checklist", () => ({
  toChecklistView: (facts: unknown) => facts,
}));
vi.mock("./onboarding/tours", () => ({
  isOnboardingTourId: (id: string) => id === "synthetic-tour",
  isTourStatus: (status: string) => status === "completed",
  recordTourProgress: h.tour,
}));
import { inboxGET, cardPOST } from "./analytics/http";
import { GET as modulesGET } from "../app/api/modules/route";
import { dispatchModuleRequest } from "../modules/dispatch";
import { GET as checklistGET } from "../app/api/onboarding/checklist/route";
import { POST as tourPOST } from "../app/api/onboarding/tours/[tourId]/route";
export const secret = "synthetic-scope-test-secret-at-least-32-characters";
export const nativeSession = () => ({
  session: { id: "session-a" },
  user: { id: "user-a", emailVerified: true },
});
export const member = () => ({
  id: "business-a",
  name: "Synthetic",
  slug: "synthetic",
  countryCode: "EC",
  currencyCode: "USD",
  timezone: "America/Guayaquil",
  categoryGcid: null,
  businessStatus: "active",
  suspensionReason: null,
  role: "owner",
  membershipStatus: "active",
  permissions: ["analytics"],
  pinMustChange: false,
});
export const joined = () => ({
  member: member(),
  subscription: null,
  billing: { access: "subscribed", trialEndsAt: null, failure: null },
});
export const cardId = "00000000-0000-4000-8000-000000000008";
export const command = {
  expectedVersion: "context-a",
  operationId: "00000000-0000-4000-8000-000000000009",
};
export const surfaces = [
  { name: "Inbox GET", call: inboxGET, method: "GET", body: undefined },
  {
    name: "Inbox decision",
    call: (r: Request) => cardPOST(r, cardId, "resolve"),
    method: "POST",
    body: command,
  },
  { name: "modules GET", call: modulesGET, method: "GET", body: undefined },
  {
    name: "module toggle",
    call: (r: Request) =>
      dispatchModuleRequest("PUT", r, { moduleId: "synthetic-module" }),
    method: "PUT",
    body: { enabled: true },
  },
  { name: "checklist GET", call: checklistGET, method: "GET", body: undefined },
  {
    name: "tour POST",
    call: (r: Request) =>
      tourPOST(r, { params: Promise.resolve({ tourId: "synthetic-tour" }) }),
    method: "POST",
    body: { status: "completed" },
  },
] as const;
export function makeRequest(
  surface: (typeof surfaces)[number],
  header?: string,
  body: unknown = surface.body,
) {
  return new Request("https://merchant.test/api", {
    method: surface.method,
    headers: {
      "content-type": "application/json",
      ...(header === undefined ? {} : { "X-Backoffice-Scope": header }),
    },
    ...(surface.method !== "GET" ? { body: JSON.stringify(body) } : {}),
  });
}
export function resetDomain() {
  for (const mock of [
    h.read,
    h.decide,
    h.evaluate,
    h.list,
    h.toggle,
    h.facts,
    h.tour,
  ])
    mock.mockClear();
}
export function domainCalls() {
  return [
    h.read,
    h.decide,
    h.evaluate,
    h.list,
    h.toggle,
    h.facts,
    h.tour,
  ].reduce((n, fn) => n + fn.mock.calls.length, 0);
}

export { h };
