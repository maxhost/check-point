import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../server/db";
import { programMemberships } from "../../../../../server/schema";
import {
  SESSION_COOKIE,
  consumerAccountResponse,
  membershipResponse,
} from "../../../../../server/consumer/core";
import { resolveSession } from "../../../../../server/consumer/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const account = await resolveSession(token);
  if (!account) {
    return NextResponse.json(
      { error: "No autorizado.", code: "unauthenticated" },
      { status: 401 },
    );
  }
  // Only the session consumer's own memberships — never another consumer's or business's.
  const memberships = await getDb()
    .select({
      id: programMemberships.id,
      programId: programMemberships.programId,
      businessId: programMemberships.businessId,
      enrolledAt: programMemberships.enrolledAt,
    })
    .from(programMemberships)
    .where(eq(programMemberships.consumerId, account.id));
  return NextResponse.json({
    account: consumerAccountResponse(account),
    memberships: memberships.map(membershipResponse),
  });
}
