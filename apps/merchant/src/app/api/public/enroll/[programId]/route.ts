import { NextResponse, type NextRequest } from "next/server";
import {
  ConsumerError,
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  consumerAccountResponse,
  membershipResponse,
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
    const { account, membership } = await enroll(programId, input);
    // Only a successful enroll opens a session (a 409 never reaches here).
    const token = await issueSession(account.id);
    const response = NextResponse.json(
      {
        account: consumerAccountResponse(account),
        membership: membershipResponse(membership),
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
