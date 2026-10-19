import { enabledModuleIds } from "../modules/activation";
import { moduleDestinationFor } from "../modules/start-page";
import type { BackofficeSession } from "./auth-guards";

const delegatedDestinations = [
  ["analytics", "/backoffice"],
  ["counter", "/backoffice/customers"],
  ["business", "/backoffice/business"],
  ["brand", "/backoffice/brand"],
  ["locations", "/backoffice/locations"],
  ["staff", "/backoffice/staff"],
  ["catalog", "/backoffice/catalog"],
  ["loyalty", "/backoffice/loyalty"],
  ["marketing", "/backoffice/marketing"],
] as const;

/** Fallback only: staff login keeps its existing single/multiple permission decision. */
export function backofficeDestination(
  enabled: ReadonlySet<string>,
  viewer: { isOwner: boolean; permissions: readonly string[] },
): string | null {
  return (
    moduleDestinationFor(enabled, viewer) ??
    (viewer.isOwner
      ? "/backoffice"
      : (delegatedDestinations.find(([permission]) =>
          viewer.permissions.includes(permission),
        )?.[1] ?? null))
  );
}

export async function readBackofficeDestination(session: BackofficeSession) {
  return backofficeDestination(await enabledModuleIds(session.business.id), {
    isOwner: session.membership.role === "owner",
    permissions: session.membership.permissions,
  });
}

/** The query is untrusted; callers supply only active locations in the session business. */
export function destinationWithLocation(
  destination: string,
  location: unknown,
  activeLocationIds: readonly string[],
): string {
  if (typeof location !== "string" || !activeLocationIds.includes(location))
    return destination;
  return `${destination}?${new URLSearchParams({ location })}`;
}
