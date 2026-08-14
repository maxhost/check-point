import { NextResponse } from "next/server";
import { cleanupExpiredBrandAssets } from "../../../../server/brand";
import { cleanupExpiredLoyaltyAssets } from "../../../../server/loyalty-program";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const [brand, loyalty] = await Promise.all([
    cleanupExpiredBrandAssets(),
    cleanupExpiredLoyaltyAssets(),
  ]);
  return NextResponse.json({ ok: true, brand, loyalty });
}
