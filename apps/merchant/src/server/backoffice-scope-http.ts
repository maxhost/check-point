import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { BackofficeContextChanged } from "../backoffice-context-contract";
import { getBackofficeRequestContext } from "./backoffice-context";
import { backofficeScopeKey } from "./backoffice-scope";

/** Apply to every handled response of an adopted private surface, including legacy clients. */
export function privateBackofficeResponse<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
function contextChanged(): NextResponse<BackofficeContextChanged> {
  return privateBackofficeResponse(
    NextResponse.json(
      {
        code: "backoffice_context_changed",
        error: "Tu sesión cambió. Actualiza el panel para continuar.",
      } satisfies BackofficeContextChanged,
      { status: 409 },
    ),
  );
}
/** Call ONLY after the surface's complete existing guard; businessId comes from that guard. */
export async function backofficeScopeFailure(
  request: Request,
  businessId: string,
): Promise<NextResponse<BackofficeContextChanged> | null> {
  const received = request.headers.get("X-Backoffice-Scope");
  // Deliberately exact: an empty/malformed adopted header is never a legacy request.
  if (received === null) return null;
  if (!/^[0-9a-f]{64}$/.test(received)) return contextChanged();
  const session = await getBackofficeRequestContext(request).readSession();
  if (!session)
    throw new Error("Backoffice scope requires the guarded native session");
  const expected = backofficeScopeKey(
    {
      sessionId: session.session.id,
      userId: session.user.id,
      businessId,
    },
    process.env.BETTER_AUTH_SECRET,
  );
  return timingSafeEqual(
    Buffer.from(received, "hex"),
    Buffer.from(expected, "hex"),
  )
    ? null
    : contextChanged();
}
