import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
} from "../../../../../server/consumer/core";
import { verifyRecovery } from "../../../../../server/consumer/recovery";
import {
  ONBOARDING_TTL_SECONDS,
  OtpError,
} from "../../../../../server/otp/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const result = await verifyRecovery(await request.json().catch(() => null));
    const response = NextResponse.json({ next: result.next });
    if (result.next === "wallet")
      response.cookies.set(SESSION_COOKIE, result.sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_TTL_DAYS * 86400,
      });
    else
      response.cookies.set(
        "consumer_recovery_onboarding",
        result.onboardingToken,
        {
          httpOnly: true,
          secure: true,
          sameSite: "strict",
          path: "/api/public/recovery/profile",
          maxAge: ONBOARDING_TTL_SECONDS,
        },
      );
    return response;
  } catch (error) {
    if (error instanceof OtpError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return NextResponse.json(
      {
        error: "El código no es válido o venció.",
        code: "invalid_or_expired_otp",
      },
      { status: 400 },
    );
  }
}
