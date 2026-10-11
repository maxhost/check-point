import { NextResponse } from "next/server";
import { expireClosingPrograms } from "@mi-pasaporte/domain/server/loyalty-program";
import { runBalanceExpiry } from "@mi-pasaporte/domain/server/loyalty-program/balance-expiry-store";

/**
 * Daily cron (`vercel.json`, 05:05 UTC = 00:05 in Ecuador): closes the programs whose window
 * ended and, since spec 0195, runs the balance-expiry sweep (notices + expirations).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  await expireClosingPrograms();
  const balances = await runBalanceExpiry(new Date());
  console.info("balance_expiry_sweep", balances);
  return NextResponse.json({ ok: true, balances });
}
