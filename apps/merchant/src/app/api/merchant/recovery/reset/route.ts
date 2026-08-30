import { NextResponse, type NextRequest } from "next/server";
import { resetPassword } from "../../../../../server/recovery/merchant-recovery";
import { MerchantRecoveryError } from "../../../../../server/recovery/internal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const result = await resetPassword(await request.json().catch(() => null), {
      headers: request.headers,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof MerchantRecoveryError)
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    console.error("merchant_recovery_reset_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      {
        error: "La recuperación de contraseña no está disponible.",
        code: "recovery_unavailable",
      },
      { status: 503 },
    );
  }
}
