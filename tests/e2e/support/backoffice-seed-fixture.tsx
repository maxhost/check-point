import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import type {
  BackofficeInitialContext,
  BackofficeModulesResult,
  SessionBilling,
} from "../../../apps/merchant/src/backoffice-context-contract";
import {
  BackofficeProvider,
  BackofficeModulesSeedConsumer,
} from "../../../apps/merchant/src/app/backoffice/backoffice-context";
import {
  readModules,
  ModuleRequestError,
} from "../../../apps/merchant/src/app/backoffice/settings/module-request";

type FixtureSession = {
  user?: { id?: string; emailVerified?: boolean };
  business?: {
    id?: string;
    status?: string;
    timezone?: string;
    currencyCode?: string;
    enabledModules?: string[];
  } | null;
  billing?: SessionBilling | null;
};
type FixtureOptions = {
  businessName: string;
  isOwner: boolean;
  permissions: string[];
};

/** Pure synthetic core, also usable without HTTP in the dedicated 0238 tests. */
export function fixtureBackofficeCore(
  options: FixtureOptions,
  session: FixtureSession = {},
): BackofficeInitialContext {
  return {
    version: 1,
    bootId: "fixture-initial",
    scopeKey: "a".repeat(64),
    userId: session.user?.id ?? "fixture-user",
    emailVerified: session.user?.emailVerified ?? true,
    business: {
      id: session.business?.id ?? "fixture-business",
      name: options.businessName,
      status: session.business?.status ?? "active",
      timezone: session.business?.timezone ?? "America/Guayaquil",
      currencyCode: session.business?.currencyCode ?? "USD",
    },
    membership: {
      role: options.isOwner ? "owner" : "staff",
      status: "active",
      permissions: options.permissions,
    },
    billing: session.billing ?? {
      access: "subscribed",
      trialDaysLeft: null,
      trialEndsAt: null,
    },
  };
}

/**
 * Existing component fixtures supply their simulated server seed from the HTTP
 * doubles they already declare. These bootstrap requests are test setup, NOT
 * app mount counts or a method comparable with M0/the direct-seed 0238 fixture.
 * No post-mutation event/store simulation: the product must implement that in B2.
 */
export async function renderBackofficeSeedFixture(
  children: ReactNode,
  options: FixtureOptions,
) {
  const [session, result] = await Promise.all([
    fetch("/api/merchant/session", { cache: "no-store" })
      .then(async (response) =>
        response.ok ? ((await response.json()) as FixtureSession) : {},
      )
      .catch(() => ({}) as FixtureSession),
    readModules()
      .then((modules): BackofficeModulesResult => ({ state: "ready", modules }))
      .catch((error: unknown): BackofficeModulesResult => ({
        state:
          error instanceof ModuleRequestError && error.status === 403
            ? "restricted"
            : "unavailable",
      })),
  ]);
  const core = fixtureBackofficeCore(options, session);
  const enabled = session.business?.enabledModules;
  const coherentModules =
    result.state === "ready" && Array.isArray(enabled)
      ? {
          ...result,
          modules: result.modules.map((module) => ({
            ...module,
            enabled: module.enabled && enabled.includes(module.id),
          })),
        }
      : result;
  createRoot(document.getElementById("root")!).render(
    <BackofficeProvider initialContext={core}>
      <BackofficeModulesSeedConsumer
        seed={{
          bootId: core.bootId,
          scopeKey: core.scopeKey,
          result: coherentModules,
        }}
      />
      {children}
    </BackofficeProvider>,
  );
}
