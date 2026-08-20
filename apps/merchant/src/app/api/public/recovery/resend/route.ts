import { NextResponse, type NextRequest } from "next/server";
import { resendRecovery } from "../../../../../server/consumer/recovery";
import { OtpError } from "../../../../../server/otp/core";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      await resendRecovery(await request.json().catch(() => null)),
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof OtpError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    return NextResponse.json(
      {
        error: "No pudimos reenviar el código.",
        code: "otp_delivery_unavailable",
      },
      { status: 503 },
    );
  }
}
