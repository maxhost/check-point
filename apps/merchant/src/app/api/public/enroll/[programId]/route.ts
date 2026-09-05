import { NextResponse, type NextRequest } from "next/server";
import {
  ConsumerError,
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  consumerAccountResponse,
  membershipResponse,
  walletManifestPathFor,
} from "../../../../../server/consumer/core";
import { validateEnrollInput } from "../../../../../server/consumer/validation";
import { enforceEnrollRateLimit } from "../../../../../server/consumer/rate-limit";
import { enroll } from "../../../../../server/consumer/enrollment";
import { issueSession } from "../../../../../server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ programId: string }> },
) {
  const { programId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "El cuerpo de la solicitud no es válido.",
        code: "invalid_body",
      },
      { status: 400 },
    );
  }
  try {
    // Rate limit is checked (and recorded) before any write, keyed by phone.
    const input = validateEnrollInput(body);
    await enforceEnrollRateLimit(input.phoneE164);
    // Origin local (ADR 0042): from the body (`loc`, sent by the branded form) or,
    // as a fallback, the query string. Validated/ignored inside `enroll` — a foreign
    // or malformed loc never breaks the alta, it just attributes null.
    const bodyLoc = (body as { loc?: unknown } | null)?.loc;
    const loc =
      typeof bodyLoc === "string"
        ? bodyLoc
        : request.nextUrl.searchParams.get("loc");
    const { account, membership } = await enroll(programId, input, loc);
    // Only a successful enroll opens a session (a 409 never reaches here).
    const token = await issueSession(account.id);
    const response = NextResponse.json(
      {
        account: consumerAccountResponse(account),
        membership: membershipResponse(membership),
        // Spec 0051 / ADR 0049: lets the confirmation inject the per-consumer manifest
        // so the icon installed THERE opens the wallet. Safe to hand over precisely
        // (and only) here: this 201 is the same response that issues the session —
        // same recipient, same power. No error path ever includes it.
        walletManifestPath: walletManifestPathFor(account.webViewToken),
      },
      { status: 201 },
    );
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    if (error instanceof ConsumerError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { error: "No pudimos completar el enrolamiento.", code: "enroll_failed" },
      { status: 503 },
    );
  }
}
