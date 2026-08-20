import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
} from "../../../../../server/consumer/core";
import { completeRecoveryProfile } from "../../../../../server/consumer/recovery";
import { OtpError } from "../../../../../server/otp/core";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const result = await completeRecoveryProfile(
      await request.json().catch(() => null),
      request.cookies.get("consumer_recovery_onboarding")?.value,
    );
    const response = NextResponse.json({ next: "wallet" }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 86400,
    });
    response.cookies.set("consumer_recovery_onboarding", "", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/api/public/recovery/profile",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (error instanceof OtpError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return NextResponse.json(
      { error: "No pudimos completar tu perfil.", code: "profile_failed" },
      { status: 409 },
    );
  }
}
