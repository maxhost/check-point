/** Spec 0238 / ADR0154. Presentation only; APIs independently authenticate and authorize. */
import type { ModuleDTO } from "./modules/activation";
import type {
  SessionBilling,
  SessionBusiness,
  SessionMembership,
} from "./server/session-view";

export type { ModuleDTO } from "./modules/activation";
export type { SessionBilling } from "./server/session-view";

/** Selection of data, never a switch that disables a guard. */
export type BackofficeSelectionMode = "page" | "active-member" | "active-owner";

/** Public IDs already exposed by the session reporter; no raw session identifier. */
export type BackofficeScope = { userId: string; businessId: string };

/** Core mounts before the independently streamed modules result. */
export type BackofficeInitialContext = {
  version: 1;
  /** Opaque render identity, shared by core and modules; not a freshness revision. */
  bootId: string;
  /** Required HMAC binding the authenticated session, user and selected business. */
  scopeKey: string;
  userId: string;
  emailVerified: boolean;
  business: Pick<
    SessionBusiness,
    "id" | "name" | "status" | "timezone" | "currencyCode"
  >;
  membership: SessionMembership;
  billing: SessionBilling;
};

/** Loading is local client state; an empty ready list is a confirmed successful read. */
export type BackofficeModulesResult =
  | { state: "ready"; modules: ModuleDTO[] }
  | { state: "restricted" }
  | { state: "unavailable" };

/** The provider additionally checks its local epoch/generation before applying this seed. */
export type BackofficeModulesSeed = {
  bootId: string;
  scopeKey: string;
  result: BackofficeModulesResult;
};

/** Only for adopted requests; the legacy session reporter keeps its current JSON. */
export type BackofficeContextChanged = {
  code: "backoffice_context_changed";
  error: "Tu sesión cambió. Actualiza el panel para continuar.";
};
