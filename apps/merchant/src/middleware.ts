import { NextResponse } from "next/server";

/**
 * `/forgot-password` must answer 503 while the feature is off (spec 0046 DoD), and a
 * server component cannot set a status code — so the gate lives here.
 *
 * Reads the env var directly instead of importing `recoveryEnabled()`: middleware runs
 * on the edge runtime, where the `node:crypto` used down that import chain is not
 * available. The API routes still apply the full check (gate + provider config).
 */
export function middleware() {
  if (process.env.PASSWORD_RECOVERY_ENABLED !== "true")
    return new NextResponse("Service Unavailable", { status: 503 });
  return NextResponse.next();
}

// Narrow on purpose: nothing else in the app should pay for this middleware.
export const config = { matcher: ["/forgot-password"] };
