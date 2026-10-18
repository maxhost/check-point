/** Server-only identity signer. No SQL, session validation replacement or HTTP comparison. */
import { createHmac } from "node:crypto";
export type BackofficeScopeIdentity = {
  sessionId: string;
  userId: string;
  businessId: string;
};
export function backofficeScopeKey(
  identity: BackofficeScopeIdentity,
  secret: string | undefined,
): string {
  if (typeof secret !== "string" || secret.length < 32)
    throw new Error("Backoffice scope requires a valid auth secret");
  if (
    [identity.sessionId, identity.userId, identity.businessId].some(
      (id) => typeof id !== "string" || id.trim().length === 0,
    )
  )
    throw new Error(
      "Backoffice scope requires complete authenticated identity",
    );
  return createHmac("sha256", secret)
    .update(
      JSON.stringify([
        "backoffice.scope.v1",
        identity.sessionId,
        identity.userId,
        identity.businessId,
      ]),
    )
    .digest("hex");
}
