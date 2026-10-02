import type { NextRequest } from "next/server";
import { handleOAuthCallback } from "../../../../../../server/oauth-callback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Spec 0119: Google vuelve por GET con `code` y `state` (o `error`). */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  return handleOAuthCallback(request, "google", {
    code: query.get("code"),
    state: query.get("state"),
    error: query.get("error"),
  });
}
