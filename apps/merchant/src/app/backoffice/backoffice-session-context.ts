import type { BackofficeInitialContext } from "../../backoffice-context-contract";

export type BackofficeSessionContext =
  | { authenticated: false }
  | {
      authenticated: true;
      user: { id: string; emailVerified: boolean };
      business: BackofficeInitialContext["business"] | null;
      membership: BackofficeInitialContext["membership"] | null;
      billing: BackofficeInitialContext["billing"] | null;
    };

export class BackofficeSessionInvalidError extends Error {
  constructor() {
    super("No pudimos leer el estado del panel.");
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/** Validate only presentation consumed here. Missing fields never become identity defaults. */
export function parseBackofficeSessionContext(
  value: unknown,
): BackofficeSessionContext {
  const invalid = () => {
    throw new BackofficeSessionInvalidError();
  };
  if (!object(value)) return invalid();
  if (value.authenticated === false) return { authenticated: false };
  if (
    value.authenticated !== true ||
    !object(value.user) ||
    typeof value.user.id !== "string" ||
    !value.user.id ||
    typeof value.user.emailVerified !== "boolean"
  )
    return invalid();
  const user = { id: value.user.id, emailVerified: value.user.emailVerified };
  if (value.business === null || value.membership === null)
    return {
      authenticated: true,
      user,
      business: null,
      membership: null,
      billing: null,
    };
  const business = value.business,
    membership = value.membership,
    billing = value.billing;
  if (
    !object(business) ||
    !object(membership) ||
    !object(billing) ||
    typeof business.id !== "string" ||
    !business.id ||
    typeof business.name !== "string" ||
    typeof business.status !== "string" ||
    typeof business.timezone !== "string" ||
    typeof business.currencyCode !== "string" ||
    typeof membership.role !== "string" ||
    typeof membership.status !== "string" ||
    !strings(membership.permissions) ||
    typeof billing.access !== "string" ||
    !["subscribed", "trial", "blocked"].includes(billing.access) ||
    (billing.trialEndsAt !== null &&
      (typeof billing.trialEndsAt !== "string" ||
        !Number.isFinite(Date.parse(billing.trialEndsAt)))) ||
    (billing.trialDaysLeft !== null &&
      (typeof billing.trialDaysLeft !== "number" ||
        !Number.isInteger(billing.trialDaysLeft) ||
        billing.trialDaysLeft < 0))
  )
    return invalid();
  return {
    authenticated: true,
    user,
    business: {
      id: business.id,
      name: business.name,
      status: business.status,
      timezone: business.timezone,
      currencyCode: business.currencyCode,
    },
    membership: {
      role: membership.role,
      status: membership.status,
      permissions: [...membership.permissions],
    },
    billing: {
      access: billing.access as BackofficeInitialContext["billing"]["access"],
      trialEndsAt: billing.trialEndsAt as string | null,
      trialDaysLeft: billing.trialDaysLeft as number | null,
    },
  };
}
